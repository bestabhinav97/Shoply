import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { env } from '../config/env.js';
import { lockUser, insertAddress, getPreferences, savePreferences } from '../modules/addresses/address.repository.js';

const address = {
  recipientName: "Åsa O'Connor", phoneNumber: '+46701234567', addressLine1: 'Testgatan 12',
  addressLine2: 'Apartment 3', postalCode: '25438', city: 'Helsingborg', countryCode: 'SE',
  isDefault: true, selectForDelivery: true,
};

test('address repository inserts on the supplied connection and serializes customer locks', async (t) => {
  const schema = `address_repository_test_${randomBytes(8).toString('hex')}`;
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
  const userId = randomUUID();
  const otherUserId = randomUUID();
  for (const id of [userId, otherUserId]) {
    await database.query(`INSERT INTO users (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, 'Repository', 'Tester', '+46701234567', $2, 'test-only-hash')`, [id, `${id}@example.com`]);
  }

  await t.test('insert returns a generated UUID, all persisted fields, and database timestamps', async () => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      assert.deepEqual(await lockUser(client, userId), { id: userId });
      const saved = await insertAddress(client, userId, { ...address, userId: otherUserId });
      assert.match(saved.id, /^[0-9a-f-]{36}$/);
      assert.equal(saved.user_id, userId);
      assert.equal(saved.recipient_name, address.recipientName);
      assert.equal(saved.phone_number, address.phoneNumber);
      assert.equal(saved.address_line1, address.addressLine1);
      assert.equal(saved.address_line2, address.addressLine2);
      assert.equal(saved.postal_code, address.postalCode);
      assert.equal(saved.city, address.city);
      assert.equal(saved.country_code, address.countryCode);
      assert.ok(saved.created_at instanceof Date);
      assert.ok(saved.updated_at instanceof Date);
      assert.equal('is_default' in saved, false);
      await client.query('COMMIT');
      assert.equal((await database.query('SELECT 1 FROM addresses WHERE id = $1 AND user_id = $2', [saved.id, userId])).rowCount, 1);
      assert.equal((await database.query('SELECT 1 FROM user_address_preferences WHERE user_id = $1', [userId])).rowCount, 0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  await t.test('rollback removes the inserted address because the repository does not commit', async () => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await lockUser(client, userId);
      const saved = await insertAddress(client, userId, { ...address, addressLine2: '' });
      await client.query('ROLLBACK');
      assert.equal((await database.query('SELECT 1 FROM addresses WHERE id = $1', [saved.id])).rowCount, 0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  await t.test('a competing customer lock waits, other customers proceed, and commit releases the lock', async () => {
    const first = await database.connect();
    const second = await database.connect();
    try {
      await first.query('BEGIN');
      await lockUser(first, userId);
      await second.query('BEGIN');
      await second.query("SET LOCAL lock_timeout = '150ms'");
      assert.deepEqual(await lockUser(second, otherUserId), { id: otherUserId });
      // A bounded timeout proves the second connection cannot take the same row lock.
      await assert.rejects(lockUser(second, userId), { code: '55P03' });
      await second.query('ROLLBACK');
      await first.query('COMMIT');
      await second.query('BEGIN');
      await second.query("SET LOCAL lock_timeout = '150ms'");
      assert.deepEqual(await lockUser(second, userId), { id: userId });
      await second.query('COMMIT');
    } finally {
      await first.query('ROLLBACK');
      await second.query('ROLLBACK');
      first.release();
      second.release();
    }
  });

  await t.test('a missing customer produces no locked row and cannot own an inserted address', async () => {
    const missingUserId = randomUUID();
    assert.equal(await lockUser(database, missingUserId), undefined);
    await assert.rejects(insertAddress(database, missingUserId, address), { code: '23503' });
  });

  await t.test('reading preferences returns undefined when no preferences row exists', async () => {
    assert.equal(await getPreferences(database, userId), undefined);
    assert.equal(await getPreferences(database, otherUserId), undefined);
  });

  await t.test('preferences can be created and updated without changing ownership or creation time', async () => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await lockUser(client, userId);
      const home = await insertAddress(client, userId, address);
      const work = await insertAddress(client, userId, { ...address, city: 'Stockholm' });
      const created = await savePreferences(client, userId, { defaultAddressId: home.id, selectedAddressId: null });
      assert.equal(created.user_id, userId);
      assert.equal(created.default_address_id, home.id);
      assert.equal(created.selected_address_id, null);
      await client.query('COMMIT');

      // Use a known old timestamp to check updates without timing-dependent sleeps.
      await database.query("UPDATE user_address_preferences SET updated_at = '2000-01-01T00:00:00Z' WHERE user_id = $1", [userId]);
      await client.query('BEGIN');
      await lockUser(client, userId);
      const updated = await savePreferences(client, userId, { defaultAddressId: home.id, selectedAddressId: work.id });
      await client.query('COMMIT');
      assert.equal(updated.default_address_id, home.id);
      assert.equal(updated.selected_address_id, work.id);
      assert.deepEqual(updated.created_at, created.created_at);
      assert.ok(updated.updated_at > new Date('2000-01-01T00:00:00Z'));
      assert.deepEqual(await getPreferences(database, userId), updated);
      assert.equal((await database.query('SELECT 1 FROM user_address_preferences WHERE user_id = $1', [userId])).rowCount, 1);
      assert.equal(await getPreferences(database, otherUserId), undefined);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  await t.test('preference writes reject foreign addresses, missing addresses and missing customers', async () => {
    const otherAddress = await insertAddress(database, otherUserId, address);
    const before = await getPreferences(database, userId);
    for (const addressId of [otherAddress.id, randomUUID()]) {
      for (const field of ['defaultAddressId', 'selectedAddressId']) {
        await assert.rejects(savePreferences(database, userId, {
          defaultAddressId: before.default_address_id, selectedAddressId: before.selected_address_id,
          [field]: addressId,
        }), { code: '23503' });
      }
    }
    await assert.rejects(savePreferences(database, randomUUID(), {
      defaultAddressId: null, selectedAddressId: null,
    }), { code: '23503' });
    assert.deepEqual(await getPreferences(database, userId), before);
  });

  await t.test('new address and preferences roll back together on the supplied connection', async () => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await lockUser(client, otherUserId);
      const saved = await insertAddress(client, otherUserId, address);
      await savePreferences(client, otherUserId, { defaultAddressId: saved.id, selectedAddressId: saved.id });
      assert.equal((await getPreferences(client, otherUserId)).selected_address_id, saved.id);
      assert.equal(await getPreferences(database, otherUserId), undefined);
      await client.query('ROLLBACK');
      assert.equal(await getPreferences(database, otherUserId), undefined);
      assert.equal((await database.query('SELECT 1 FROM addresses WHERE id = $1', [saved.id])).rowCount, 0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  await t.test('existing preference changes can be rolled back or explicitly cleared', async () => {
    const before = await getPreferences(database, userId);
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await lockUser(client, userId);
      const cleared = await savePreferences(client, userId, { defaultAddressId: null, selectedAddressId: null });
      assert.equal(cleared.default_address_id, null);
      assert.equal(cleared.selected_address_id, null);
      await client.query('ROLLBACK');
      assert.deepEqual(await getPreferences(database, userId), before);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
