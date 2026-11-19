import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import braintree from 'braintree';
import { env } from '../config/env.js';

test('customer service reuses links and recovers safely from concurrent requests and partial failures', async (t) => {
  const schema = `payment_service_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const previousOptions = process.env.PGOPTIONS;
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const originalCredentials = env.braintree;
  env.braintree = { merchantId: 'test-merchant', publicKey: 'test-public', privateKey: 'test-private' };
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  const { getOrCreateBraintreeCustomer: getCustomer, savePaymentMethod } = await import('../modules/payments/payment.service.js');
  const repository = await import('../modules/payments/payment.repository.js');
  const { getBraintreeGateway } = await import('../modules/payments/braintree.client.js');
  t.after(async () => {
    env.braintree = originalCredentials;
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    if (previousOptions === undefined) delete process.env.PGOPTIONS;
    else process.env.PGOPTIONS = previousOptions;
  });
  await migrate();

  const vault = new Map();
  const stableId = (userId) => `sl_${userId.replaceAll('-', '')}`;
  const notFound = () => Object.assign(new Error('Not found'), { type: braintree.errorTypes.notFoundError });
  const findCustomer = async (id) => {
    if (!vault.has(id)) throw notFound();
    return { id };
  };
  const createCustomer = async ({ id }) => {
    assert.equal(vault.has(id), false, 'duplicate remote creation');
    vault.set(id, { id });
    return { success: true, customer: { id } };
  };
  const gateway = getBraintreeGateway();
  const find = t.mock.method(gateway.customer, 'find', findCustomer);
  const create = t.mock.method(gateway.customer, 'create', createCustomer);
  async function newUser() {
    const id = randomUUID();
    await pool.query(`INSERT INTO users (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, 'Service', 'Tester', '+46701234567', $2, 'test-only-hash')`, [id, `${id}@example.com`]);
    return id;
  }
  const unavailable = (error) => error.status === 503
    && error.message === 'Customer setup is temporarily unavailable. Please try again later.';

  await t.test('existing links are reused without a provider call', async () => {
    const userId = await newUser();
    await repository.createBraintreeCustomerLink(userId, 'existing-customer');
    assert.equal(await getCustomer(userId), 'existing-customer');
    assert.equal(find.mock.callCount(), 0);
    assert.equal(create.mock.callCount(), 0);
  });

  await t.test('creation persists the stable ID and shares no personal or card data', async () => {
    const userId = await newUser();
    const id = await getCustomer(userId);
    assert.equal(id, stableId(userId));
    assert.equal(id.length, 35);
    assert.deepEqual(create.mock.calls.at(-1).arguments, [{ id }]);
    assert.equal((await repository.findBraintreeCustomerByUserId(userId)).braintree_customer_id, id);
    const calls = create.mock.callCount();
    assert.equal(await getCustomer(userId), id);
    assert.equal(create.mock.callCount(), calls);
  });

  await t.test('missing users are rejected before provider access', async () => {
    const calls = find.mock.callCount();
    await assert.rejects(getCustomer(randomUUID()), { status: 401, message: 'Please sign in to continue.' });
    assert.equal(find.mock.callCount(), calls);
  });

  await t.test('concurrent calls create one remote customer and one local link', async () => {
    const userId = await newUser();
    const calls = create.mock.callCount();
    const result = await Promise.all(Array.from({ length: 4 }, () => getCustomer(userId)));
    assert.deepEqual(result, Array(4).fill(stableId(userId)));
    assert.equal(create.mock.callCount(), calls + 1);
    assert.equal((await pool.query('SELECT 1 FROM braintree_customers WHERE user_id = $1', [userId])).rowCount, 1);
  });

  await t.test('lookup failures never trigger creation and expose only a safe error', async () => {
    const userId = await newUser();
    const calls = create.mock.callCount();
    try {
      for (const behavior of [async () => { throw new Error('private-auth-details'); }, async () => null, async () => ({ id: 'another-customer' })]) {
        find.mock.mockImplementation(behavior);
        await assert.rejects(getCustomer(userId), unavailable);
        assert.equal(await repository.findBraintreeCustomerByUserId(userId), null);
      }
      assert.equal(create.mock.callCount(), calls);
    } finally {
      find.mock.mockImplementation(findCustomer);
    }
  });

  await t.test('failed or malformed creation responses do not persist a link', async () => {
    const userId = await newUser();
    try {
      for (const result of [null, { success: false }, { success: true }, { success: true, customer: { id: 'wrong-customer' } }]) {
        create.mock.mockImplementation(async () => result);
        await assert.rejects(getCustomer(userId), unavailable);
        assert.equal(await repository.findBraintreeCustomerByUserId(userId), null);
      }
    } finally {
      create.mock.mockImplementation(createCustomer);
    }
  });

  await t.test('retry recovers when a remote creation succeeds but its response is lost', async () => {
    const userId = await newUser();
    const calls = create.mock.callCount();
    create.mock.mockImplementation(async (input) => {
      await createCustomer(input);
      throw new Error('private-timeout-details');
    });
    try {
      await assert.rejects(getCustomer(userId), unavailable);
      assert.equal(await repository.findBraintreeCustomerByUserId(userId), null);
    } finally {
      create.mock.mockImplementation(createCustomer);
    }
    assert.equal(await getCustomer(userId), stableId(userId));
    assert.equal(create.mock.callCount(), calls + 1);
  });

  await t.test('retry links the same remote customer after a database insert failure', async () => {
    const userId = await newUser();
    const calls = create.mock.callCount();
    await pool.query(`CREATE FUNCTION reject_customer_link() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test insert failure'; END $$`);
    await pool.query(`CREATE TRIGGER reject_customer_link BEFORE INSERT ON braintree_customers
      FOR EACH ROW EXECUTE FUNCTION reject_customer_link()`);
    try {
      await assert.rejects(getCustomer(userId), unavailable);
      assert.equal(await repository.findBraintreeCustomerByUserId(userId), null);
      assert.ok(vault.has(stableId(userId)));
    } finally {
      await pool.query('DROP TRIGGER reject_customer_link ON braintree_customers');
      await pool.query('DROP FUNCTION reject_customer_link()');
    }
    assert.equal(await getCustomer(userId), stableId(userId));
    assert.equal(create.mock.callCount(), calls + 1);
  });

  const savedCard = {
    token: 'saved-token', customerId: '', cardType: 'Mastercard', last4: '1234',
    expirationMonth: '12', expirationYear: '2030', billingAddress: { streetAddress: 'private' },
  };
  const saveCard = t.mock.method(gateway.paymentMethod, 'create', async ({ customerId }) => ({
    success: true, paymentMethod: { ...savedCard, customerId },
  }));

  await t.test('saving a card creates/reuses the customer and returns only the public card summary', async () => {
    const userId = await newUser();
    const result = await savePaymentMethod(userId, 'single-use-nonce');
    assert.deepEqual(saveCard.mock.calls.at(-1).arguments, [{
      customerId: stableId(userId), paymentMethodNonce: 'single-use-nonce', options: { verifyCard: true },
    }]);
    assert.deepEqual(result, {
      token: 'saved-token', brand: 'Mastercard', last4: '1234', expirationMonth: '12', expirationYear: '2030',
    });
    assert.equal((await repository.findBraintreeCustomerByUserId(userId)).braintree_customer_id, stableId(userId));
    const calls = create.mock.callCount();
    await savePaymentMethod(userId, 'second-single-use-nonce');
    assert.equal(create.mock.callCount(), calls);
  });

  await t.test('missing users cannot save a card', async () => {
    const calls = saveCard.mock.callCount();
    await assert.rejects(savePaymentMethod(randomUUID(), 'single-use-nonce'), { status: 401 });
    assert.equal(saveCard.mock.callCount(), calls);
  });

  await t.test('declined/invalid nonces receive safe 422 feedback and preserve the customer link', async () => {
    const userId = await newUser();
    saveCard.mock.mockImplementation(async () => ({ success: false, message: 'private-validation-details' }));
    await assert.rejects(savePaymentMethod(userId, 'used-or-rejected-nonce'), {
      status: 422, message: 'The card could not be saved or verified. Enter the card details again or try another card.',
    });
    assert.equal((await repository.findBraintreeCustomerByUserId(userId)).braintree_customer_id, stableId(userId));
  });

  await t.test('malformed responses or a different customer never return another customer’s card', async () => {
    const userId = await newUser();
    const card = { ...savedCard, customerId: stableId(userId) };
    for (const result of [null, {}, { success: true },
      ...[{ customerId: 'someone-else' }, { token: '' }, { last4: '1234567890123456' },
        { expirationMonth: '13' }, { expirationYear: 'bad' }, { cardType: null }]
        .map((changes) => ({ success: true, paymentMethod: { ...card, ...changes } }))]) {
      saveCard.mock.mockImplementation(async () => result);
      await assert.rejects(savePaymentMethod(userId, 'single-use-nonce'), {
        status: 503, message: 'Couldn’t confirm that the card was saved. Please try again later.',
      });
    }
  });

  await t.test('SDK failures are sanitized and do not automatically retry a consumed nonce', async () => {
    const userId = await newUser();
    const calls = saveCard.mock.callCount();
    saveCard.mock.mockImplementation(async () => { throw new Error('secret-provider-details'); });
    await assert.rejects(savePaymentMethod(userId, 'single-use-nonce'), {
      status: 503, message: 'Couldn’t confirm that the card was saved. Please try again later.',
    });
    assert.equal(saveCard.mock.callCount(), calls + 1);
  });
});
