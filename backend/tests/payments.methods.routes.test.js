import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import braintree from 'braintree';
import { env } from '../config/env.js';

test('payment-method creation saves verified cards only under the session customer', async (t) => {
  const schema = `payment_methods_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const previousOptions = process.env.PGOPTIONS;
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const originalCredentials = env.braintree;
  env.braintree = { merchantId: 'test-merchant', publicKey: 'test-public', privateKey: 'test-private' };
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  t.after(async () => {
    env.braintree = originalCredentials;
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
  const lookup = t.mock.method(gateway.customer, 'find', async () => {
    throw Object.assign(new Error('Not found'), { type: braintree.errorTypes.notFoundError });
  });
  const createCustomer = t.mock.method(gateway.customer, 'create', async ({ id }) => ({ success: true, customer: { id } }));
  const savedCard = (customerId) => ({
    token: 'saved-card-token', customerId, cardType: 'Visa', last4: '1111',
    expirationMonth: '12', expirationYear: '2030', billingAddress: { streetAddress: 'private-address' },
  });
  const save = async ({ customerId }) => ({ success: true, paymentMethod: savedCard(customerId) });
  const saveCard = t.mock.method(gateway.paymentMethod, 'create', save);

  async function register(email) {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const result = await agent.post('/api/auth/register').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', csrf.body.csrfToken).send({
        firstName: 'Method', lastName: 'Tester', phoneNumber: '0701234567', email,
        password: 'a secure customer setup passphrase',
      }).expect(201);
    return { agent, csrf: csrf.body.csrfToken, id: result.body.user.id };
  }
  const owner = await register('method-owner@example.com');
  const other = await register('method-other@example.com');
  const nonce = 'private-test-nonce';
  const post = (body = { nonce }, suffix = '', user = owner) => user.agent.post(`/api/payments/methods${suffix}`)
    .set('Origin', env.appOrigin).set('X-CSRF-Token', user.csrf).send(body);
  const saved = {
    paymentMethod: { token: 'saved-card-token', brand: 'Visa', last4: '1111', expirationMonth: '12', expirationYear: '2030' },
  };

  await t.test('authentication and CSRF are required before customer access', async () => {
    const guest = await request(app).post('/api/payments/methods').send({ nonce }).expect(401);
    assert.equal(guest.headers['cache-control'], 'no-store');
    await owner.agent.post('/api/payments/methods').set('Origin', env.appOrigin).send({ nonce }).expect(403);
    await owner.agent.post('/api/payments/methods').set('Origin', 'https://other.example')
      .set('X-CSRF-Token', owner.csrf).send({ nonce }).expect(403);
    await owner.agent.post('/api/payments/methods').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', 'invalid').send({ nonce }).expect(403);
    await owner.agent.post('/api/payments/methods').set('Origin', env.appOrigin)
      .set('X-CSRF-Token', owner.csrf).type('form').send({ nonce }).expect(403);
    assert.equal(lookup.mock.callCount(), 0);
    assert.equal(createCustomer.mock.callCount(), 0);
    assert.equal(saveCard.mock.callCount(), 0);
  });

  await t.test('invalid bodies and supplied ownership identifiers are rejected without side effects', async () => {
    for (const body of [{}, [], { nonce: 123 }, { nonce: '' }, { nonce: 'a b' }, { nonce: 'a\nb' },
      { nonce: 'x'.repeat(1025) }, { nonce, userId: other.id }, { nonce, customerId: 'foreign' }]) {
      const result = await post(body).expect(400);
      assert.ok(!JSON.stringify(result.body).includes(nonce));
    }
    await post({ nonce }, '?userId=foreign').expect(400);
    assert.equal((await pool.query('SELECT 1 FROM braintree_customers')).rowCount, 0);
    assert.equal(lookup.mock.callCount(), 0);
    assert.equal(saveCard.mock.callCount(), 0);
  });

  await t.test('creates the session customer and returns only the saved token and masked details', async () => {
    const result = await post().expect(201);
    assert.deepEqual(result.body, saved);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual(createCustomer.mock.calls[0].arguments, [{ id: `sl_${owner.id.replaceAll('-', '')}` }]);
    const { rows } = await pool.query('SELECT * FROM braintree_customers WHERE user_id = $1', [owner.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].braintree_customer_id, `sl_${owner.id.replaceAll('-', '')}`);
    assert.deepEqual(saveCard.mock.calls[0].arguments, [{
      customerId: rows[0].braintree_customer_id, paymentMethodNonce: nonce, options: { verifyCard: true },
    }]);
    assert.equal(saveCard.mock.callCount(), 1);
    assert.deepEqual((await post({ nonce: 'another-private-test-nonce' }).expect(201)).body, saved);
    assert.equal(createCustomer.mock.callCount(), 1);
  });

  await t.test('another session uses only its own existing link', async () => {
    await pool.query('INSERT INTO braintree_customers (user_id, braintree_customer_id) VALUES ($1, $2)', [other.id, 'other-customer']);
    assert.deepEqual((await post({ nonce }, '', other).expect(201)).body, saved);
    assert.equal(createCustomer.mock.callCount(), 1);
    assert.equal(saveCard.mock.calls.at(-1).arguments[0].customerId, 'other-customer');
    await pool.query('DELETE FROM braintree_customers WHERE user_id = $1', [other.id]);
  });

  await t.test('provider errors do not expose details or create a local link', async () => {
    const calls = saveCard.mock.callCount();
    lookup.mock.mockImplementation(async () => { throw new Error('private-credential-details'); });
    const result = await post({ nonce }, '', other).expect(503);
    assert.deepEqual(result.body, { message: 'Customer setup is temporarily unavailable. Please try again later.' });
    assert.equal((await pool.query('SELECT 1 FROM braintree_customers WHERE user_id = $1', [other.id])).rowCount, 0);
    assert.equal(saveCard.mock.callCount(), calls);
  });

  await t.test('verification failures and SDK exceptions return safe errors without retrying', async () => {
    saveCard.mock.mockImplementation(async () => ({ success: false, message: 'private-provider-message', creditCardVerification: { processorResponseText: 'private-decline' } }));
    const rejected = await post().expect(422);
    assert.deepEqual(rejected.body, { message: 'The card could not be saved or verified. Enter the card details again or try another card.' });
    const calls = saveCard.mock.callCount();
    saveCard.mock.mockImplementation(async () => { throw new Error('private-auth-or-network-error'); });
    const failed = await post().expect(503);
    assert.deepEqual(failed.body, { message: 'Couldn’t confirm that the card was saved. Please try again later.' });
    assert.equal(saveCard.mock.callCount(), calls + 1);
    saveCard.mock.mockImplementation(save);
  });

  await t.test('rate limiting prevents further customer work', async () => {
    let limited = false;
    for (let index = 0; index < 21; index += 1) {
      const calls = createCustomer.mock.callCount();
      const saveCalls = saveCard.mock.callCount();
      const result = await post({ nonce: `rate-test-${index}` });
      if (result.status === 429) {
        assert.equal(result.headers['cache-control'], 'no-store');
        assert.ok(result.headers['retry-after']);
        assert.equal(createCustomer.mock.callCount(), calls);
        assert.equal(saveCard.mock.callCount(), saveCalls);
        limited = true;
        break;
      }
      assert.equal(result.status, 201);
    }
    assert.ok(limited);
  });
});
