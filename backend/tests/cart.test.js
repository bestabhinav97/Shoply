import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { env } from '../config/env.js';

test('cart API persists customer carts and enforces ownership, stock and CSRF', async (t) => {
  const schema = `cart_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  await migrate();
  const { default: app } = await import('../app.js');
  const customer = request.agent(app);
  const other = request.agent(app);
  async function mutate(agent, method, path, body = {}) {
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    return agent[method](path).set('Origin', env.appOrigin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send(body);
  }
  for (const [index, agent] of [customer, other].entries()) {
    const result = await mutate(agent, 'post', '/api/auth/register', {
      firstName: 'Cart', lastName: 'Tester', phoneNumber: '0701234567',
      email: `cart${index}@example.com`, password: 'a secure cart test passphrase',
    });
    assert.equal(result.status, 201);
  }
  const categoryId = randomUUID();
  const productId = randomUUID();
  const variantId = randomUUID();
  await pool.query("INSERT INTO categories (id, name, slug) VALUES ($1, 'Home', 'home')", [categoryId]);
  await pool.query("INSERT INTO products (id, category_id, slug, name, description, status) VALUES ($1, $2, 'cup', 'Cup', 'A cup', 'active')", [productId, categoryId]);
  await pool.query("INSERT INTO product_variants (id, product_id, sku, price_minor) VALUES ($1, $2, 'CUP', 12500)", [variantId, productId]);
  await pool.query('INSERT INTO inventory (variant_id, quantity) VALUES ($1, 5)', [variantId]);
  await pool.query(`INSERT INTO product_images (id, product_id, variant_id, storage_key, alt_text, width, height, position)
    VALUES ($1, $2, NULL, 'products/cup.webp', 'Cup', 800, 800, 0),
      ($3, $2, $4, 'products/cup-variant.webp', 'Selected cup', 800, 800, 1)`,
  [randomUUID(), productId, randomUUID(), variantId]);
  let itemId;
  await t.test('authentication, empty cart, CSRF and strict validation', async () => {
    await request(app).get('/api/cart').expect(401);
    await request(app).post('/api/cart/items').send({ variantId, quantity: 1 }).expect(401);
    const empty = await customer.get('/api/cart').expect(200);
    assert.equal(empty.headers['cache-control'], 'no-store');
    assert.deepEqual(empty.body, { items: [], itemCount: 0, subtotalMinor: 0, currency: 'SEK' });
    await customer.post('/api/cart/items').send({ variantId, quantity: 1 }).expect(403);
    for (const body of [{ variantId, quantity: 0 }, { variantId, quantity: 1.5 }, { variantId, quantity: '2' }, { variantId, quantity: 100 }, { variantId: 'bad', quantity: 1 }, { variantId, quantity: 1, priceMinor: 1 }]) {
      assert.equal((await mutate(customer, 'post', '/api/cart/items', body)).status, 400);
    }
  });
  await t.test('add and concurrent additions merge a variant without lost updates', async () => {
    const added = await mutate(customer, 'post', '/api/cart/items', { variantId, quantity: 1 });
    assert.equal(added.status, 200);
    assert.deepEqual(added.body.items[0].image, { url: '/images/products/cup-variant.webp', alt: 'Selected cup', width: 800, height: 800 });
    itemId = added.body.items[0].id;
    const responses = await Promise.all([1, 2].map(() => mutate(customer, 'post', '/api/cart/items', { variantId, quantity: 1 })));
    responses.forEach((result) => assert.equal(result.status, 200));
    const cart = await customer.get('/api/cart').expect(200);
    assert.equal(cart.body.items.length, 1);
    assert.equal(cart.body.itemCount, 3);
    assert.equal(cart.body.subtotalMinor, 37500);
    assert.equal((await pool.query('SELECT quantity FROM inventory WHERE variant_id=$1', [variantId])).rows[0].quantity, 5);
  });
  await t.test('ownership and rejected stock changes leave persisted quantities intact', async () => {
    assert.equal((await mutate(other, 'patch', `/api/cart/items/${itemId}`, { quantity: 1 })).status, 404);
    assert.equal((await mutate(other, 'delete', `/api/cart/items/${itemId}`)).status, 404);
    assert.equal((await other.get('/api/cart')).body.itemCount, 0);
    assert.equal((await mutate(customer, 'post', '/api/cart/items', { variantId, quantity: 3 })).status, 409);
    assert.equal((await mutate(customer, 'patch', `/api/cart/items/${itemId}`, { quantity: 6 })).status, 409);
    assert.equal((await customer.get('/api/cart')).body.itemCount, 3);
    const updated = await mutate(customer, 'patch', `/api/cart/items/${itemId}`, { quantity: 2 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.itemCount, 2);
  });
  await t.test('current prices and availability are returned; inactive products cannot be added', async () => {
    await pool.query('UPDATE product_variants SET price_minor=13000 WHERE id=$1', [variantId]);
    await pool.query('UPDATE inventory SET quantity=1 WHERE variant_id=$1', [variantId]);
    const cart = await customer.get('/api/cart').expect(200);
    assert.equal(cart.body.subtotalMinor, 26000);
    assert.equal(cart.body.items[0].available, false);
    await pool.query("UPDATE products SET status='archived' WHERE id=$1", [productId]);
    assert.equal((await mutate(customer, 'post', '/api/cart/items', { variantId, quantity: 1 })).status, 409);
    assert.equal((await mutate(customer, 'post', '/api/cart/items', { variantId: randomUUID(), quantity: 1 })).status, 409);
    const removed = await mutate(customer, 'delete', `/api/cart/items/${itemId}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.itemCount, 0);
    assert.equal((await customer.get('/api/cart')).body.items.length, 0);
  });
});
