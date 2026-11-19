import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { env } from '../config/env.js';

test('Braintree customer links enforce one-to-one ownership and survive migration reruns', async (t) => {
  const schema = `payment_links_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const database = new pg.Pool({ ...env.db, options: `-c search_path=${schema}` });
  const { migrate } = await import('../db/migrate.js');
  const { pool } = await import('../db/db.js');
  t.after(async () => {
    await database.end();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  await migrate(database);

  const owner = randomUUID();
  const other = randomUUID();
  for (const userId of [owner, other]) {
    await database.query(`INSERT INTO users (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, 'Payment', 'Tester', '+46701234567', $2, 'test-only-hash')`, [userId, `${userId}@example.com`]);
  }
  const insert = (userId, customerId) => database.query(`INSERT INTO braintree_customers
    (user_id, braintree_customer_id) VALUES ($1, $2) RETURNING *`, [userId, customerId]);
  const { rows: [link] } = await insert(owner, 'sandbox-customer-owner');

  await t.test('links a real user and records timestamps without card data', () => {
    assert.equal(link.user_id, owner);
    assert.equal(link.braintree_customer_id, 'sandbox-customer-owner');
    assert.ok(link.created_at instanceof Date);
    assert.ok(link.updated_at instanceof Date);
    assert.deepEqual(Object.keys(link).sort(), ['braintree_customer_id', 'created_at', 'updated_at', 'user_id']);
  });

  await t.test('each user has only one link and each Braintree customer only one owner', async () => {
    await assert.rejects(insert(owner, 'different-customer'), { code: '23505' });
    await assert.rejects(insert(other, 'sandbox-customer-owner'), { code: '23505' });
    assert.equal((await database.query('SELECT * FROM braintree_customers')).rowCount, 1);
  });

  await t.test('missing users and invalid customer IDs are rejected', async () => {
    await assert.rejects(insert(randomUUID(), 'missing-user-customer'), { code: '23503' });
    await assert.rejects(insert(null, 'missing-user-id'), { code: '23502' });
    await assert.rejects(insert(other, null), { code: '23502' });
    for (const customerId of ['', '   ', ' padded', 'padded ']) {
      await assert.rejects(insert(other, customerId), { code: '23514' });
    }
    await assert.rejects(insert(other, 'x'.repeat(256)), { code: '22001' });
  });

  await t.test('rerunning migrations preserves links and applies the migration once', async () => {
    await migrate(database);
    assert.deepEqual((await database.query('SELECT * FROM braintree_customers WHERE user_id = $1', [owner])).rows[0], link);
    assert.equal((await database.query("SELECT 1 FROM schema_migrations WHERE name = '007_braintree_customers.sql'")).rowCount, 1);
  });

  await t.test('deleting a user removes only their local link', async () => {
    await insert(other, 'sandbox-customer-other');
    await database.query('DELETE FROM users WHERE id = $1', [owner]);
    assert.equal((await database.query('SELECT 1 FROM braintree_customers WHERE user_id = $1', [owner])).rowCount, 0);
    assert.equal((await database.query('SELECT 1 FROM braintree_customers WHERE user_id = $1', [other])).rowCount, 1);
  });
});
