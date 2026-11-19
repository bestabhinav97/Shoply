import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { env } from '../config/env.js';

test('payment repository reads and inserts customer links without replacing ownership', async (t) => {
  const schema = `payment_repository_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const previousOptions = process.env.PGOPTIONS;
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  const { findBraintreeCustomerByUserId: find, createBraintreeCustomerLink: create } = await import('../modules/payments/payment.repository.js');
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    if (previousOptions === undefined) delete process.env.PGOPTIONS;
    else process.env.PGOPTIONS = previousOptions;
  });
  await migrate();

  const owner = randomUUID();
  const other = randomUUID();
  for (const userId of [owner, other]) {
    await pool.query(`INSERT INTO users (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, 'Payment', 'Tester', '+46701234567', $2, 'test-only-hash')`, [userId, `${userId}@example.com`]);
  }
  let originalLink;

  await t.test('missing links return null without creating rows', async () => {
    assert.equal(await find(owner), null);
    assert.equal(await find(randomUUID()), null);
    assert.equal((await pool.query('SELECT 1 FROM braintree_customers')).rowCount, 0);
  });

  await t.test('inserts a link and reads only the requested user using the default pool', async () => {
    originalLink = await create(owner, 'sandbox-owner');
    assert.equal(originalLink.user_id, owner);
    assert.equal(originalLink.braintree_customer_id, 'sandbox-owner');
    assert.ok(originalLink.created_at instanceof Date);
    assert.ok(originalLink.updated_at instanceof Date);
    assert.deepEqual(await find(owner), originalLink);
    assert.equal(await find(other), null);
  });

  await t.test('duplicate links and missing users fail without replacing the existing link', async () => {
    await assert.rejects(create(owner, 'replacement'), { code: '23505' });
    await assert.rejects(create(other, 'sandbox-owner'), { code: '23505' });
    await assert.rejects(create(randomUUID(), 'missing-user'), { code: '23503' });
    assert.deepEqual(await find(owner), originalLink);
    assert.equal(await find(other), null);
  });

  await t.test('a supplied transaction controls visibility and rollback', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const link = await create(other, 'transaction-customer', client);
      assert.deepEqual(await find(other, client), link);
      assert.equal(await find(other), null);
      await client.query('ROLLBACK');
      assert.equal(await find(other), null);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  await t.test('customer references are treated as SQL values, never executable SQL', async () => {
    const customerId = "customer'; DROP TABLE users; --";
    await create(other, customerId);
    assert.equal((await find(other)).braintree_customer_id, customerId);
    assert.equal((await pool.query('SELECT 1 FROM users')).rowCount, 2);
    assert.deepEqual(await find(owner), originalLink);
  });
});
