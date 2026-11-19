import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { env } from '../config/env.js';

const address = {
  recipientName: 'Ada Test', phoneNumber: '+46701234567', addressLine1: 'Testgatan 12',
  addressLine2: '', postalCode: '25438', city: 'Helsingborg', countryCode: 'SE',
  isDefault: false, selectForDelivery: false,
};

test('address service saves atomically and applies default and selection rules', async (t) => {
  const schema = `address_service_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  const { addAddress, getAddressBook, selectDeliveryAddress, setDefaultAddress } = await import('../modules/addresses/address.service.js');
  const repository = await import('../modules/addresses/address.repository.js');
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  await migrate();

  async function createUser() {
    const id = randomUUID();
    await pool.query(`INSERT INTO users (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, 'Service', 'Tester', '+46701234567', $2, 'test-only-hash')`, [id, `${id}@example.com`]);
    return id;
  }
  const userId = await createUser();
  let homeId, workId;

  await t.test('empty book reads return null preferences without creating rows', async () => {
    assert.deepEqual(await getAddressBook(userId), { items: [], defaultAddressId: null, selectedAddressId: null });
    assert.equal(await repository.getPreferences(pool, userId), undefined);
  });

  await t.test('first account-page address becomes default with no explicit delivery selection', async () => {
    const result = await addAddress(userId, address);
    homeId = result.items[0].id;
    assert.deepEqual(result, {
      items: [{ id: homeId, ...Object.fromEntries(Object.entries(address).filter(([key]) => !['isDefault', 'selectForDelivery'].includes(key))) }],
      defaultAddressId: homeId, selectedAddressId: null,
    });
    assert.equal((await repository.getPreferences(pool, userId)).default_address_id, homeId);
    assert.deepEqual(await getAddressBook(userId), result);
  });

  await t.test('chooser save selects the new address without changing the default', async () => {
    const result = await addAddress(userId, { ...address, city: 'Stockholm', selectForDelivery: true });
    workId = result.items.find((item) => item.city === 'Stockholm').id;
    assert.equal(result.items.length, 2);
    assert.equal(result.defaultAddressId, homeId);
    assert.equal(result.selectedAddressId, workId);
  });

  await t.test('account-page save preserves selection; requested default changes only the default', async () => {
    const result = await addAddress(userId, { ...address, city: 'Malmö', isDefault: true });
    const newId = result.items.find((item) => item.city === 'Malmö').id;
    assert.equal(result.defaultAddressId, newId);
    assert.equal(result.selectedAddressId, workId);
    const next = await addAddress(userId, address);
    assert.equal(next.defaultAddressId, newId);
    assert.equal(next.selectedAddressId, workId);
  });

  await t.test('another customer receives only their own addresses and preferences', async () => {
    const otherId = await createUser();
    const result = await addAddress(otherId, { ...address, selectForDelivery: true, userId });
    assert.equal(result.items.length, 1);
    assert.equal(result.defaultAddressId, result.items[0].id);
    assert.equal(result.selectedAddressId, result.items[0].id);
    assert.notEqual(result.items[0].id, homeId);
    assert.equal((await repository.listAddresses(pool, userId)).length, 4);
    assert.deepEqual(await repository.listAddresses(pool, randomUUID()), []);
    assert.deepEqual(await getAddressBook(otherId), result);
    assert.equal((await getAddressBook(userId)).items.length, 4);
  });

  await t.test('preference failure rolls back the new address and preserves existing choices', async () => {
    const before = await repository.listAddresses(pool, userId);
    const preferences = await repository.getPreferences(pool, userId);
    // NOT VALID leaves old rows intact while forcing subsequent preference writes to fail.
    await pool.query('ALTER TABLE user_address_preferences ADD CONSTRAINT test_reject_writes CHECK (false) NOT VALID');
    try {
      await assert.rejects(addAddress(userId, { ...address, isDefault: true, selectForDelivery: true }), { code: '23514' });
      await assert.rejects(selectDeliveryAddress(userId, homeId), { code: '23514' });
      await assert.rejects(setDefaultAddress(userId, homeId), { code: '23514' });
    } finally {
      await pool.query('ALTER TABLE user_address_preferences DROP CONSTRAINT test_reject_writes');
    }
    assert.deepEqual(await repository.listAddresses(pool, userId), before);
    assert.deepEqual(await repository.getPreferences(pool, userId), preferences);
  });

  await t.test('simultaneous first saves keep one default and return both persisted addresses', async () => {
    const concurrentId = await createUser();
    const results = await Promise.all([
      addAddress(concurrentId, address),
      addAddress(concurrentId, { ...address, city: 'Göteborg' }),
    ]);
    const first = results.find((result) => result.items.length === 1);
    const second = results.find((result) => result.items.length === 2);
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.defaultAddressId, second.defaultAddressId);
    assert.equal(second.selectedAddressId, null);
    assert.equal((await repository.listAddresses(pool, concurrentId)).length, 2);
  });

  await t.test('limit check is serialized and rejected saves leave the book unchanged', async () => {
    const limitedId = await createUser();
    for (let index = 0; index < 19; index++) await addAddress(limitedId, address);
    const results = await Promise.allSettled([
      addAddress(limitedId, address), addAddress(limitedId, address),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.find((result) => result.status === 'rejected').reason.status, 409);
    assert.equal((await repository.listAddresses(pool, limitedId)).length, 20);
  });

  await t.test('deleted customers cannot create an address or preferences', async () => {
    const missingId = randomUUID();
    await assert.rejects(addAddress(missingId, address), { status: 401 });
    assert.deepEqual(await repository.listAddresses(pool, missingId), []);
    assert.equal(await repository.getPreferences(pool, missingId), undefined);
    await assert.rejects(selectDeliveryAddress(missingId, homeId), { status: 401 });
    await assert.rejects(setDefaultAddress(missingId, homeId), { status: 401 });
  });

  await t.test('selecting an owned address preserves the default and changes no address details', async () => {
    const before = await getAddressBook(userId);
    const result = await selectDeliveryAddress(userId, homeId);
    assert.deepEqual(result.items, before.items);
    assert.equal(result.defaultAddressId, before.defaultAddressId);
    assert.equal(result.selectedAddressId, homeId);
    assert.deepEqual(await getAddressBook(userId), result);
  });

  await t.test('missing and foreign addresses both return 404 without changing preferences', async () => {
    const otherId = await createUser();
    const foreign = await addAddress(otherId, address);
    const before = await repository.getPreferences(pool, userId);
    for (const id of [foreign.items[0].id, randomUUID()]) {
      await assert.rejects(selectDeliveryAddress(userId, id), { status: 404, message: 'Address not found.' });
      await assert.rejects(setDefaultAddress(userId, id), { status: 404, message: 'Address not found.' });
    }
    assert.deepEqual(await repository.getPreferences(pool, userId), before);
  });

  await t.test('a concurrent add and selection preserve each other’s changes', async () => {
    const concurrentId = await createUser();
    const home = await addAddress(concurrentId, address);
    const homeAddressId = home.items[0].id;
    await Promise.all([
      addAddress(concurrentId, { ...address, city: 'Stockholm' }),
      selectDeliveryAddress(concurrentId, homeAddressId),
    ]);
    const result = await getAddressBook(concurrentId);
    assert.equal(result.items.length, 2);
    assert.equal(result.defaultAddressId, homeAddressId);
    assert.equal(result.selectedAddressId, homeAddressId);
  });

  await t.test('setting a default preserves explicit selection, address details and null selection', async () => {
    const before = await getAddressBook(userId);
    const changed = await setDefaultAddress(userId, workId);
    assert.equal(changed.defaultAddressId, workId);
    assert.equal(changed.selectedAddressId, before.selectedAddressId);
    assert.deepEqual(changed.items, before.items);
    assert.deepEqual(await getAddressBook(userId), changed);
    const otherId = await createUser();
    await addAddress(otherId, address);
    const other = await addAddress(otherId, { ...address, city: 'Stockholm' });
    const work = other.items.find((item) => item.city === 'Stockholm');
    assert.equal((await setDefaultAddress(otherId, work.id)).selectedAddressId, null);
  });

  await t.test('concurrent default and selection updates do not overwrite each other', async () => {
    const concurrentId = await createUser();
    const first = await addAddress(concurrentId, address);
    const home = first.items[0].id;
    const second = await addAddress(concurrentId, { ...address, city: 'Stockholm' });
    const work = second.items.find((item) => item.id !== home).id;
    await Promise.all([setDefaultAddress(concurrentId, work), selectDeliveryAddress(concurrentId, home)]);
    const result = await getAddressBook(concurrentId);
    assert.equal(result.defaultAddressId, work);
    assert.equal(result.selectedAddressId, home);
  });
});
