import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { env } from '../config/env.js';

test('client-token endpoint authenticates, protects requests and safely delegates to Braintree', async (t) => {
  const schema = `payments_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  const originalCredentials = env.braintree;
  t.after(async () => {
    env.braintree = originalCredentials;
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  await migrate();
  const { default: app } = await import('../app.js');
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/auth/register').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send({
      firstName: 'Payment', lastName: 'Tester', phoneNumber: '0701234567',
      email: 'payments@example.com', password: 'a secure payments test passphrase',
    }).expect(201);
  const post = (body = {}, suffix = '') => agent.post(`/api/payments/client-token${suffix}`)
    .set('Origin', env.appOrigin).set('X-CSRF-Token', csrf.body.csrfToken).send(body);
  const unavailable = { message: 'Card setup is temporarily unavailable. Please try again later.' };

  await t.test('missing configuration returns 503 without exposing details', async () => {
    env.braintree = { merchantId: '', publicKey: '', privateKey: '' };
    const result = await post().expect(503);
    assert.deepEqual(result.body, unavailable);
    assert.equal(result.headers['cache-control'], 'no-store');
  });

  // Only dummy credentials and a stubbed SDK are used: tests never contact Braintree.
  env.braintree = { merchantId: 'test-merchant', publicKey: 'test-public', privateKey: 'test-private' };
  const { getBraintreeGateway } = await import('../modules/payments/braintree.client.js');
  const gateway = getBraintreeGateway();
  const provider = t.mock.method(gateway.clientToken, 'generate', async () => ({ clientToken: 'test-client-token', privateDetail: 'do-not-expose' }));

  await t.test('auth, CSRF, Origin and content type block requests before provider access', async () => {
    const guest = await request(app).post('/api/payments/client-token').send({}).expect(401);
    assert.equal(guest.headers['cache-control'], 'no-store');
    await agent.post('/api/payments/client-token').set('Origin', env.appOrigin).send({}).expect(403);
    await agent.post('/api/payments/client-token').set('Origin', 'https://other.example')
      .set('X-CSRF-Token', csrf.body.csrfToken).send({}).expect(403);
    await agent.post('/api/payments/client-token').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', 'invalid-token').send({}).expect(403);
    await agent.post('/api/payments/client-token').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', csrf.body.csrfToken).type('form').send({}).expect(403);
    assert.equal(provider.mock.callCount(), 0);
  });

  await t.test('unsupported input cannot select a customer or gateway options', async () => {
    await post({ customerId: 'other-customer' }).expect(400);
    await post([]).expect(400);
    await post({}, '?customerId=other-customer').expect(400);
    assert.equal(provider.mock.callCount(), 0);
  });

  await t.test('success returns only the token, disables caching and uses no customer options', async () => {
    const result = await post().expect(200);
    assert.deepEqual(result.body, { clientToken: 'test-client-token' });
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual(provider.mock.calls[0].arguments, [{}]);
  });

  await t.test('provider errors and invalid responses stay private', async () => {
    provider.mock.mockImplementation(async () => { throw new Error('private-key-and-request-detail'); });
    assert.deepEqual((await post().expect(503)).body, unavailable);
    for (const value of [null, {}, { clientToken: '' }, { clientToken: '  ' }, { clientToken: 123 }]) {
      provider.mock.mockImplementation(async () => value);
      assert.deepEqual((await post().expect(503)).body, unavailable);
    }
  });

  await t.test('rate limiting blocks repeated token generation', async () => {
    provider.mock.mockImplementation(async () => ({ clientToken: 'test-client-token' }));
    let limited = false;
    for (let index = 0; index < 21; index += 1) {
      const previousCalls = provider.mock.callCount();
      const result = await post();
      if (result.status === 429) {
        assert.equal(provider.mock.callCount(), previousCalls);
        assert.ok(result.headers['retry-after']);
        assert.equal(result.headers['cache-control'], 'no-store');
        limited = true;
        break;
      }
      assert.equal(result.status, 200);
    }
    assert.ok(limited);
  });
});
