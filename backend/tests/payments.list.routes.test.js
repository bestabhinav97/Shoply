import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { env } from '../config/env.js';

test('saved-card reads are authenticated, private and never create customers', async (t) => {
  const schema = `payment_list_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const previousOptions = process.env.PGOPTIONS;
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const previousCredentials = env.braintree;
  env.braintree = { merchantId: 'test', publicKey: 'test', privateKey: 'test' };
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  t.after(async () => {
    env.braintree = previousCredentials;
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    if (previousOptions === undefined) delete process.env.PGOPTIONS;
    else process.env.PGOPTIONS = previousOptions;
  });
  await migrate();
  const { default: app } = await import('../app.js');
  const { getBraintreeGateway } = await import('../modules/payments/braintree.client.js');
  const gateway = getBraintreeGateway();
  const vault = new Map();
  const lookup = t.mock.method(gateway.customer, 'find', async (id) => vault.get(id));
  const create = t.mock.method(gateway.customer, 'create', async () => { throw new Error('Read must not create.'); });
  const save = t.mock.method(gateway.paymentMethod, 'create', async () => { throw new Error('Read must not save.'); });
  async function register(email) {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const result = await agent.post('/api/auth/register').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send({
        firstName: 'List', lastName: 'Tester', phoneNumber: '0701234567', email,
        password: 'a secure card listing passphrase',
      }).expect(201);
    return { agent, id: result.body.user.id };
  }
  const owner = await register('list-owner@example.com');
  const other = await register('list-other@example.com');
  const card = {
    token: 'owner-card', customerId: 'owner-vault', cardType: 'Visa', last4: '1111',
    expirationMonth: '12', expirationYear: '2030', billingAddress: { streetAddress: 'private' }, bin: '411111',
  };
  const summary = { token: 'owner-card', brand: 'Visa', last4: '1111', expirationMonth: '12', expirationYear: '2030' };

  await t.test('guests get 401; an unlinked user gets an empty list without a provider call', async () => {
    await request(app).get('/api/payments/methods').expect(401);
    const result = await owner.agent.get('/api/payments/methods').expect(200);
    assert.deepEqual(result.body, { items: [] });
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(lookup.mock.callCount(), 0);
    assert.equal((await pool.query('SELECT 1 FROM braintree_customers')).rowCount, 0);
  });

  await pool.query('INSERT INTO braintree_customers (user_id, braintree_customer_id) VALUES ($1, $2)', [owner.id, 'owner-vault']);
  await pool.query('INSERT INTO braintree_customers (user_id, braintree_customer_id) VALUES ($1, $2)', [other.id, 'other-vault']);
  vault.set('owner-vault', { id: 'owner-vault', creditCards: [card], email: 'private@example.com' });
  vault.set('other-vault', { id: 'other-vault', creditCards: [] });

  await t.test('returns only masked summaries for the session owner, including on repeated reads', async () => {
    for (let index = 0; index < 2; index += 1) {
      const result = await owner.agent.get('/api/payments/methods').expect(200);
      assert.deepEqual(result.body, { items: [summary] });
      assert.equal(result.headers['cache-control'], 'no-store');
      assert.deepEqual(lookup.mock.calls.at(-1).arguments, ['owner-vault']);
    }
    assert.deepEqual((await other.agent.get('/api/payments/methods').expect(200)).body, { items: [] });
    assert.deepEqual(lookup.mock.calls.at(-1).arguments, ['other-vault']);
  });

  await t.test('query/body IDs cannot override session ownership', async () => {
    const calls = lookup.mock.callCount();
    await owner.agent.get('/api/payments/methods?customerId=other-vault').expect(400);
    await owner.agent.get('/api/payments/methods').send({ userId: other.id }).expect(400);
    assert.equal(lookup.mock.callCount(), calls);
  });

  await t.test('provider failures, missing customer and mismatched cards get safe 503 responses', async () => {
    const unavailable = { message: 'Saved cards are temporarily unavailable. Please try again later.' };
    for (const value of [null, { id: 'wrong', creditCards: [] }, { id: 'owner-vault' },
      { id: 'owner-vault', creditCards: [{ ...card, customerId: 'other-vault' }] },
      { id: 'owner-vault', creditCards: [{ ...card, last4: '4111111111111111' }] }]) {
      vault.set('owner-vault', value);
      assert.deepEqual((await owner.agent.get('/api/payments/methods').expect(503)).body, unavailable);
    }
    lookup.mock.mockImplementationOnce(async () => { throw new Error('private-provider-details'); });
    assert.deepEqual((await owner.agent.get('/api/payments/methods').expect(503)).body, unavailable);
    vault.set('owner-vault', { id: 'owner-vault', creditCards: [card] });
  });

  await t.test('read limits stop further provider access', async () => {
    let limited = false;
    for (let index = 0; index < 61; index += 1) {
      const calls = lookup.mock.callCount();
      const result = await owner.agent.get('/api/payments/methods');
      if (result.status === 429) {
        assert.equal(lookup.mock.callCount(), calls);
        assert.ok(result.headers['retry-after']);
        limited = true;
        break;
      }
      assert.equal(result.status, 200);
    }
    assert.ok(limited);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(save.mock.callCount(), 0);
  });
});
