import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { env } from '../config/env.js';

test('address migration enforces ownership, preferences and data constraints', async (t) => {
  const schema = `addresses_test_${randomBytes(8).toString('hex')}`;
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
      VALUES ($1, 'Schema', 'Tester', '+46701234567', $2, 'test-only-hash')`, [userId, `${userId}@example.com`]);
  }
  async function insertAddress(userId, overrides = {}) {
    const row = { id: randomUUID(), recipient: 'Åsa Test', phone: '+46701234567', line1: 'Testgatan 12',
      postcode: '25438', city: 'Helsingborg', country: 'SE', ...overrides };
    const result = await database.query(`INSERT INTO addresses
      (id, user_id, recipient_name, phone_number, address_line1, postal_code, city, country_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [row.id, userId, row.recipient, row.phone, row.line1, row.postcode, row.city, row.country]);
    return result.rows[0];
  }
  const home = await insertAddress(owner);
  const work = await insertAddress(owner, { city: 'Stockholm' });
  const foreign = await insertAddress(other);

  await t.test('multiple addresses have stable IDs, optional line 2 and timestamps', () => {
    assert.notEqual(home.id, work.id);
    assert.equal(home.user_id, owner);
    assert.equal(home.address_line2, '');
    assert.ok(home.created_at instanceof Date);
    assert.ok(home.updated_at instanceof Date);
  });

  await t.test('default and selected addresses can differ for one customer', async () => {
    await database.query(`INSERT INTO user_address_preferences
      (user_id, default_address_id, selected_address_id) VALUES ($1, $2, $3)`, [owner, home.id, work.id]);
    const { rows: [preferences] } = await database.query('SELECT * FROM user_address_preferences WHERE user_id = $1', [owner]);
    assert.equal(preferences.default_address_id, home.id);
    assert.equal(preferences.selected_address_id, work.id);
    await assert.rejects(database.query('INSERT INTO user_address_preferences (user_id) VALUES ($1)', [owner]), { code: '23505' });
  });

  await t.test('preferences reject missing addresses and addresses owned by another user', async () => {
    for (const column of ['default_address_id', 'selected_address_id']) {
      for (const addressId of [foreign.id, randomUUID()]) {
        await assert.rejects(database.query(`UPDATE user_address_preferences SET ${column} = $1 WHERE user_id = $2`, [addressId, owner]), { code: '23503' });
      }
    }
    await assert.rejects(insertAddress(randomUUID()), { code: '23503' });
    await assert.rejects(database.query('INSERT INTO user_address_preferences (user_id) VALUES ($1)', [randomUUID()]), { code: '23503' });
  });

  await t.test('database rejects invalid required fields and unsupported countries', async () => {
    for (const invalid of [{ recipient: ' ' }, { line1: '' }, { city: ' ' }, { phone: '0701234567' },
      { postcode: '254 38' }, { postcode: 'ABCDE' }, { country: 'US' }]) {
      await assert.rejects(insertAddress(owner, invalid));
    }
    await assert.rejects(insertAddress(owner, { city: null }), { code: '23502' });
    await assert.rejects(insertAddress(owner, { city: 'x'.repeat(101) }), { code: '22001' });
  });

  await t.test('deleting an address clears only its preference references', async () => {
    await database.query('DELETE FROM addresses WHERE id = $1', [home.id]);
    const { rows: [preferences] } = await database.query('SELECT * FROM user_address_preferences WHERE user_id = $1', [owner]);
    assert.equal(preferences.user_id, owner);
    assert.equal(preferences.default_address_id, null);
    assert.equal(preferences.selected_address_id, work.id);
  });

  await t.test('deleting a user cascades to their addresses and preferences only', async () => {
    await database.query('DELETE FROM users WHERE id = $1', [owner]);
    assert.equal((await database.query('SELECT 1 FROM addresses WHERE user_id = $1', [owner])).rowCount, 0);
    assert.equal((await database.query('SELECT 1 FROM user_address_preferences WHERE user_id = $1', [owner])).rowCount, 0);
    assert.equal((await database.query('SELECT 1 FROM addresses WHERE id = $1', [foreign.id])).rowCount, 1);
  });

  await t.test('rerunning migrations preserves address rows', async () => {
    await migrate(database);
    assert.equal((await database.query('SELECT 1 FROM addresses WHERE id = $1', [foreign.id])).rowCount, 1);
    assert.equal((await database.query("SELECT 1 FROM schema_migrations WHERE name = '006_addresses.sql'")).rowCount, 1);
  });
});
