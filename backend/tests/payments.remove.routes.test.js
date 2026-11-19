import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import braintree from 'braintree';
import { env } from '../config/env.js';

test('card removal verifies ownership, CSRF and safe retry behavior', async (t) => {
  const schema = `payment_remove_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const previousOptions = process.env.PGOPTIONS;
  const previousCredentials = env.braintree;
  process.env.PGOPTIONS = `-c search_path=${schema}`;
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
  const card = { token: 'owner-card', customerId: 'owner-vault', cardType: 'Visa', last4: '1111',
    expirationMonth: '12', expirationYear: '2030' };
  let cards = [card, { ...card, token: 'second-card' }];
  const find = t.mock.method(gateway.customer, 'find', async (id) => ({
    id, creditCards: id === 'owner-vault' ? cards : [],
  }));
  const destroy = t.mock.method(gateway.paymentMethod, 'delete', async (token) => {
    cards = cards.filter((item) => item.token !== token);
  });
  const create = t.mock.method(gateway.customer, 'create', async () => { throw new Error('Never create on delete.'); });
  async function register(email, customerId) {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
    const response = await agent.post('/api/auth/register').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', csrf).send({ firstName: 'Remove', lastName: 'Tester',
        phoneNumber: '0701234567', email, password: 'a secure card removal passphrase' }).expect(201);
    if (customerId) await pool.query('INSERT INTO braintree_customers(user_id,braintree_customer_id) VALUES ($1,$2)',
      [response.body.user.id, customerId]);
    return { agent, csrf };
  }
  const owner = await register('remove-owner@example.com', 'owner-vault');
  const other = await register('remove-other@example.com', 'other-vault');
  const unlinked = await register('remove-unlinked@example.com');
  const remove = (user, body = { token: 'owner-card' }) => user.agent.delete('/api/payments/methods')
    .set('Origin', env.appOrigin).set('X-CSRF-Token', user.csrf).send(body);

  await t.test('authentication, origin and CSRF are required before provider calls', async () => {
    await request(app).delete('/api/payments/methods').send({ token: card.token }).expect(401);
    await owner.agent.delete('/api/payments/methods').send({ token: card.token }).expect(403);
    await owner.agent.delete('/api/payments/methods').set('Origin', 'https://foreign.example')
      .set('X-CSRF-Token', owner.csrf).send({ token: card.token }).expect(403);
    assert.equal(find.mock.callCount(), 0);
    assert.equal(destroy.mock.callCount(), 0);
  });
  await t.test('invalid tokens, body overrides and queries are rejected', async () => {
    for (const body of [{}, { token: '' }, { token: '../other' }, { token: 'x'.repeat(256) },
      { token: card.token, customerId: 'owner-vault' }, { token: card.token, userId: 'other' }]) {
      await remove(owner, body).expect(400);
    }
    await owner.agent.delete('/api/payments/methods?customerId=owner-vault')
      .set('Origin', env.appOrigin).set('X-CSRF-Token', owner.csrf).send({ token: card.token }).expect(400);
    assert.equal(find.mock.callCount(), 0);
  });
  await t.test('foreign and unlinked tokens never reach deletion or create a customer', async () => {
    await remove(other).expect(204);
    await remove(unlinked).expect(204);
    assert.equal(destroy.mock.callCount(), 0);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(cards.length, 2);
  });
  await t.test('provider failures and malformed ownership responses are sanitized', async () => {
    for (const response of [null, { id: 'wrong', creditCards: [card] },
      { id: 'owner-vault', creditCards: [{ ...card, customerId: 'other-vault' }] }]) {
      find.mock.mockImplementationOnce(async () => response);
      const result = await remove(owner).expect(503);
      assert.equal(result.body.message, 'Could not confirm card removal. Refresh your saved cards before trying again.');
    }
    assert.equal(destroy.mock.callCount(), 0);
    destroy.mock.mockImplementationOnce(async () => { throw new Error('private-provider-secret'); });
    const result = await remove(owner).expect(503);
    assert.ok(!JSON.stringify(result.body).includes('private-provider-secret'));
    assert.equal(cards.length, 2);
  });
  await t.test('removes only the selected token, including when last four digits match', async () => {
    const response = await remove(owner).expect(204);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(destroy.mock.calls.at(-1).arguments, ['owner-card']);
    assert.deepEqual(cards.map((item) => item.token), ['second-card']);
    const calls = destroy.mock.callCount();
    await remove(owner).expect(204);
    assert.equal(destroy.mock.callCount(), calls);
    assert.equal((await owner.agent.get('/api/payments/methods').expect(200)).body.items.length, 1);
  });
  await t.test('a concurrent removal already completed at the provider is successful', async () => {
    destroy.mock.mockImplementationOnce(async () => {
      cards = [];
      throw Object.assign(new Error('Not found'), { type: braintree.errorTypes.notFoundError });
    });
    await remove(owner, { token: 'second-card' }).expect(204);
  });
  await t.test('rate limits stop further provider access', async () => {
    let limited = false;
    for (let index = 0; index < 21; index++) {
      const count = find.mock.callCount();
      const result = await remove(owner);
      if (result.status === 429) {
        assert.equal(find.mock.callCount(), count);
        assert.ok(result.headers['retry-after']);
        limited = true;
        break;
      }
      assert.equal(result.status, 204);
    }
    assert.ok(limited);
  });
});
