import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { env } from '../config/env.js';

const details = { recipientName: 'Ada Test', phoneNumber: '+46701234567', addressLine1: 'Testgatan 12',
  addressLine2: '', postalCode: '25438', city: 'Helsingborg', countryCode: 'SE' };

test('address edit and removal preserve ownership and repair preferences atomically', async (t) => {
  const schema = `address_manage_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  const service = await import('../modules/addresses/address.service.js');
  const repository = await import('../modules/addresses/address.repository.js');
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  await migrate();
  const { default: app } = await import('../app.js');

  async function account(email) {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const registration = await agent.post('/api/auth/register').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send({ firstName: 'Ada', lastName: 'Test',
        phoneNumber: '0701234567', email, password: 'a secure address test passphrase' }).expect(201);
    const write = (method, path, body = {}) => agent[method](path).set('Origin', env.appOrigin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send(body);
    return { agent, write, userId: registration.body.user.id };
  }
  const owner = await account('edit-address@example.com');
  const other = await account('foreign-address@example.com');
  const first = await owner.write('post', '/api/addresses', { ...details, isDefault: false, selectForDelivery: true }).expect(201);
  const home = first.body.items[0].id;
  const second = await owner.write('post', '/api/addresses', { ...details, city: 'Stockholm', isDefault: false, selectForDelivery: false }).expect(201);
  const work = second.body.items.find((item) => item.id !== home).id;
  const foreignBook = await other.write('post', '/api/addresses', { ...details, isDefault: false, selectForDelivery: true }).expect(201);
  const foreign = foreignBook.body.items[0].id;

  await t.test('edit and delete enforce session, CSRF, ownership and input validation', async () => {
    for (const method of ['patch', 'delete']) {
      await request(app)[method](`/api/addresses/${home}`).send(details).expect(401);
      await owner.agent[method](`/api/addresses/${home}`).set('Origin', env.appOrigin).send(details).expect(403);
      for (const id of [foreign, randomUUID()]) await owner.write(method, `/api/addresses/${id}`, details).expect(404);
      await owner.write(method, '/api/addresses/invalid', details).expect(400);
    }
    await owner.write('patch', `/api/addresses/${home}`, { ...details, postalCode: 'invalid' }).expect(400);
    await owner.write('patch', `/api/addresses/${home}`, { ...details, userId: other.userId }).expect(400);
    await owner.write('patch', `/api/addresses/${home}`, { ...details, isDefault: true }).expect(400);
    assert.deepEqual((await owner.agent.get('/api/addresses').expect(200)).body, second.body);
    assert.deepEqual((await other.agent.get('/api/addresses').expect(200)).body, foreignBook.body);
  });

  await t.test('edit normalizes details, preserves IDs/preferences and survives GET', async () => {
    await pool.query("UPDATE addresses SET updated_at = '2000-01-01T00:00:00Z' WHERE id = $1", [home]);
    const before = (await repository.listAddresses(pool, owner.userId)).find((row) => row.id === home);
    const result = await owner.write('patch', `/api/addresses/${home.toUpperCase()}`, {
      ...details, city: ' Uppsala ', postalCode: '254 38', phoneNumber: '0701234567', addressLine2: 'Apartment 4',
    }).expect(200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.body.items.length, 2);
    assert.equal(result.body.defaultAddressId, home);
    assert.equal(result.body.selectedAddressId, home);
    const saved = result.body.items.find((item) => item.id === home);
    assert.equal(saved.city, 'Uppsala');
    assert.equal(saved.postalCode, '25438');
    assert.equal(saved.phoneNumber, '+46701234567');
    assert.equal(saved.addressLine2, 'Apartment 4');
    const after = (await repository.listAddresses(pool, owner.userId)).find((row) => row.id === home);
    assert.deepEqual(after.created_at, before.created_at);
    assert.ok(after.updated_at > before.updated_at);
    assert.deepEqual((await owner.agent.get('/api/addresses').expect(200)).body, result.body);
  });

  await t.test('deleting default/selected falls back; deleting last returns an empty book', async () => {
    const result = await owner.write('delete', `/api/addresses/${home}`).expect(200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.body.defaultAddressId, work);
    assert.equal(result.body.selectedAddressId, null);
    assert.deepEqual(result.body.items.map((item) => item.id), [work]);
    assert.equal((await pool.query('SELECT 1 FROM addresses WHERE id = $1', [home])).rowCount, 0);
    await owner.write('delete', `/api/addresses/${home}`).expect(404);
    const empty = await owner.write('delete', `/api/addresses/${work}`).expect(200);
    assert.deepEqual(empty.body, { items: [], defaultAddressId: null, selectedAddressId: null });
    assert.deepEqual((await owner.agent.get('/api/addresses').expect(200)).body, empty.body);
    assert.deepEqual((await other.agent.get('/api/addresses').expect(200)).body, foreignBook.body);
  });

  async function fixture() {
    const userId = randomUUID();
    await pool.query(`INSERT INTO users (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, 'Manage', 'Tester', '+46701234567', $2, 'test-only-hash')`, [userId, `${userId}@example.com`]);
    const ids = [];
    for (let index = 0; index < 3; index++) {
      const result = await service.addAddress(userId, { ...details, recipientName: `Recipient ${index}`,
        isDefault: false, selectForDelivery: index === 2 });
      const id = result.items.find((item) => item.recipientName === `Recipient ${index}`).id;
      ids.push(id);
      await pool.query('UPDATE addresses SET created_at = $2 WHERE id = $1', [id, new Date(Date.UTC(2020 + index, 0, 1))]);
    }
    return { userId, ids };
  }

  await t.test('delete repairs only affected preferences and chooses the oldest remaining default', async () => {
    for (const index of [0, 1, 2]) {
      const { userId, ids } = await fixture();
      const result = await service.removeAddress(userId, ids[index]);
      assert.equal(result.defaultAddressId, index === 0 ? ids[1] : ids[0]);
      assert.equal(result.selectedAddressId, index === 2 ? null : ids[2]);
      assert.equal(result.items.length, 2);
    }
  });

  await t.test('preference failure rolls back deletion and all original references', async () => {
    const { userId, ids } = await fixture();
    const before = await service.getAddressBook(userId);
    await pool.query('ALTER TABLE user_address_preferences ADD CONSTRAINT test_reject_manage CHECK (false) NOT VALID');
    try {
      await assert.rejects(service.removeAddress(userId, ids[1]), { code: '23514' });
    } finally {
      await pool.query('ALTER TABLE user_address_preferences DROP CONSTRAINT test_reject_manage');
    }
    assert.deepEqual(await service.getAddressBook(userId), before);
  });

  await t.test('simultaneous edit/delete serialize and leave no stale preferences', async () => {
    const { userId, ids } = await fixture();
    const [edited, removed] = await Promise.allSettled([
      service.editAddress(userId, ids[0], { ...details, city: 'Uppsala' }),
      service.removeAddress(userId, ids[0]),
    ]);
    assert.equal(removed.status, 'fulfilled');
    if (edited.status === 'rejected') assert.equal(edited.reason.status, 404);
    const result = await service.getAddressBook(userId);
    assert.equal(result.items.length, 2);
    assert.equal(result.defaultAddressId, ids[1]);
    assert.equal(result.selectedAddressId, ids[2]);
  });
});
