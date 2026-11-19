import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { env } from '../config/env.js';

test('address POST and GET persist and load only the authenticated customer’s address book', async (t) => {
  const schema = `address_routes_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  await migrate();
  const { default: app } = await import('../app.js');
  const body = { recipientName: 'Ada Test', phoneNumber: '+46701234567', addressLine1: 'Testgatan 12',
    addressLine2: '', postalCode: '25438', city: 'Helsingborg', countryCode: 'SE', isDefault: false, selectForDelivery: true };

  await request(app).post('/api/addresses').send(body).expect(401);
  await request(app).get('/api/addresses').expect(401);
  await request(app).patch('/api/addresses/selected').send({ addressId: randomUUID() }).expect(401);
  const customer = request.agent(app);
  const csrf = await customer.get('/api/auth/csrf').expect(200);
  const registration = await customer.post('/api/auth/register').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send({
      firstName: 'Ada', lastName: 'Test', phoneNumber: '0701234567',
      email: 'address-wiring@example.com', password: 'a secure address test passphrase',
    }).expect(201);

  const empty = await customer.get('/api/addresses').expect(200);
  assert.equal(empty.headers['cache-control'], 'no-store');
  assert.deepEqual(empty.body, { items: [], defaultAddressId: null, selectedAddressId: null });
  assert.equal((await pool.query('SELECT 1 FROM user_address_preferences WHERE user_id = $1', [registration.body.user.id])).rowCount, 0);

  await customer.post('/api/addresses').set('Origin', env.appOrigin).send(body).expect(403);
  await customer.post('/api/addresses').set('Origin', 'https://other.example')
    .set('X-CSRF-Token', csrf.body.csrfToken).send(body).expect(403);

  const invalid = await customer.post('/api/addresses').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send({ ...body, postalCode: 'invalid' }).expect(400);
  assert.equal(invalid.body.message, 'Please check your address.');
  assert.equal(typeof invalid.body.fields.postalCode, 'string');
  await customer.post('/api/addresses').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send({ ...body, userId: 'someone-else' }).expect(400);
  assert.equal((await pool.query('SELECT 1 FROM addresses')).rowCount, 0);

  const result = await customer.post('/api/addresses').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send(body).expect(201);
  assert.equal(result.headers['cache-control'], 'no-store');
  const { isDefault: _default, selectForDelivery: _selected, ...details } = body;
  const firstId = result.body.items[0].id;
  assert.deepEqual(result.body, {
    items: [{ id: firstId, ...details }], defaultAddressId: firstId, selectedAddressId: firstId,
  });
  const saved = await pool.query('SELECT * FROM addresses WHERE id = $1', [firstId]);
  assert.equal(saved.rows[0].user_id, registration.body.user.id);
  assert.equal(saved.rows[0].city, body.city);
  assert.equal('userId' in result.body.items[0], false);
  assert.equal('user_id' in result.body.items[0], false);
  const reloaded = await customer.get('/api/addresses').expect(200);
  assert.deepEqual(reloaded.body, result.body);
  assert.equal(reloaded.headers['cache-control'], 'no-store');

  const second = await customer.post('/api/addresses').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send({
      ...body, postalCode: '254 38', phoneNumber: '0701234567', city: 'Stockholm', selectForDelivery: false,
    }).expect(201);
  assert.equal(second.body.items.length, 2);
  const normalized = second.body.items.find((item) => item.id !== firstId);
  assert.equal(normalized.postalCode, '25438');
  assert.equal(normalized.phoneNumber, '+46701234567');
  assert.equal(second.body.defaultAddressId, firstId);
  assert.equal(second.body.selectedAddressId, firstId);

  const third = await customer.post('/api/addresses').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send({
      ...body, city: 'Uppsala', isDefault: true, selectForDelivery: false,
    }).expect(201);
  assert.equal(third.body.defaultAddressId, third.body.items.find((item) => item.city === 'Uppsala').id);
  assert.equal(third.body.selectedAddressId, firstId);

  const other = request.agent(app);
  const otherCsrf = await other.get('/api/auth/csrf').expect(200);
  const otherRegistration = await other.post('/api/auth/register').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', otherCsrf.body.csrfToken).send({
      firstName: 'Other', lastName: 'Customer', phoneNumber: '0701234567',
      email: 'other-address@example.com', password: 'a secure address test passphrase',
    }).expect(201);
  const otherEmpty = await other.get('/api/addresses').expect(200);
  assert.deepEqual(otherEmpty.body, { items: [], defaultAddressId: null, selectedAddressId: null });
  const privateResult = await other.post('/api/addresses').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', otherCsrf.body.csrfToken).send(body).expect(201);
  assert.equal(privateResult.body.items.length, 1);
  const otherId = privateResult.body.items[0].id;
  assert.ok(!third.body.items.some((item) => item.id === otherId));
  assert.equal((await pool.query('SELECT user_id FROM addresses WHERE id = $1', [otherId])).rows[0].user_id, otherRegistration.body.user.id);
  assert.equal((await pool.query('SELECT 1 FROM addresses WHERE user_id = $1', [registration.body.user.id])).rowCount, 3);
  const preferencesBefore = await pool.query('SELECT * FROM user_address_preferences ORDER BY user_id');
  assert.deepEqual((await customer.get('/api/addresses').expect(200)).body, third.body);
  assert.deepEqual((await other.get('/api/addresses').query({ userId: registration.body.user.id }).expect(200)).body, privateResult.body);
  const preferencesAfter = await pool.query('SELECT * FROM user_address_preferences ORDER BY user_id');
  assert.deepEqual(preferencesAfter.rows, preferencesBefore.rows);

  const select = (selection) => customer.patch('/api/addresses/selected')
    .set('Origin', env.appOrigin).set('X-CSRF-Token', csrf.body.csrfToken).send(selection);
  await customer.patch('/api/addresses/selected').set('Origin', env.appOrigin)
    .send({ addressId: normalized.id }).expect(403);
  await customer.patch('/api/addresses/selected').set('Origin', 'https://other.example')
    .set('X-CSRF-Token', csrf.body.csrfToken).send({ addressId: normalized.id }).expect(403);
  await select({ addressId: 'invalid' }).expect(400);
  await select({ addressId: normalized.id, userId: otherRegistration.body.user.id }).expect(400);
  const foreignSelection = await select({ addressId: otherId }).expect(404);
  const missingSelection = await select({ addressId: randomUUID() }).expect(404);
  assert.deepEqual(foreignSelection.body, missingSelection.body);
  assert.deepEqual((await customer.get('/api/addresses').expect(200)).body, third.body);

  const selected = await select({ addressId: normalized.id.toUpperCase() }).expect(200);
  assert.equal(selected.headers['cache-control'], 'no-store');
  assert.deepEqual(selected.body.items, third.body.items);
  assert.equal(selected.body.defaultAddressId, third.body.defaultAddressId);
  assert.equal(selected.body.selectedAddressId, normalized.id);
  assert.deepEqual((await customer.get('/api/addresses').expect(200)).body, selected.body);
  assert.deepEqual((await other.get('/api/addresses').expect(200)).body, privateResult.body);
  const repeated = await select({ addressId: normalized.id }).expect(200);
  assert.deepEqual(repeated.body, selected.body);

  await request(app).patch('/api/addresses/default').send({ addressId: firstId }).expect(401);
  await customer.patch('/api/addresses/default').set('Origin', env.appOrigin).send({ addressId: firstId }).expect(403);
  await customer.patch('/api/addresses/default').set('Origin', 'https://other.example')
    .set('X-CSRF-Token', csrf.body.csrfToken).send({ addressId: firstId }).expect(403);
  const makeDefault = (selection) => customer.patch('/api/addresses/default')
    .set('Origin', env.appOrigin).set('X-CSRF-Token', csrf.body.csrfToken).send(selection);
  await makeDefault({ addressId: 'invalid' }).expect(400);
  await makeDefault({ addressId: firstId, userId: otherRegistration.body.user.id }).expect(400);
  const foreignDefault = await makeDefault({ addressId: otherId }).expect(404);
  const missingDefault = await makeDefault({ addressId: randomUUID() }).expect(404);
  assert.deepEqual(foreignDefault.body, missingDefault.body);
  assert.deepEqual((await customer.get('/api/addresses').expect(200)).body, selected.body);
  const defaultChanged = await makeDefault({ addressId: firstId.toUpperCase() }).expect(200);
  assert.equal(defaultChanged.headers['cache-control'], 'no-store');
  assert.equal(defaultChanged.body.defaultAddressId, firstId);
  assert.equal(defaultChanged.body.selectedAddressId, normalized.id);
  assert.deepEqual(defaultChanged.body.items, selected.body.items);
  assert.deepEqual((await customer.get('/api/addresses').expect(200)).body, defaultChanged.body);
  assert.deepEqual((await other.get('/api/addresses').expect(200)).body, privateResult.body);
  assert.deepEqual((await makeDefault({ addressId: firstId }).expect(200)).body, defaultChanged.body);
});
