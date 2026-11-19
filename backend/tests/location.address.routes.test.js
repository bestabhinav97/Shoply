import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { env } from '../config/env.js';

test('full-address lookup protects the endpoint and returns suggestions without saving addresses', async (t) => {
  const schema = `address_lookup_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  const originalKey = env.geoapifyApiKey;
  env.geoapifyApiKey = 'test-key';
  t.after(async () => {
    env.geoapifyApiKey = originalKey;
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  await migrate();
  const { default: app } = await import('../app.js');
  const provider = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    features: [{ properties: { street: 'Testgatan', housenumber: '12', city: 'Helsingborg', postcode: '254 38', country_code: 'se', state: 'Skåne' } }],
  })));
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/auth/register').set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken).send({ firstName: 'Lookup', lastName: 'Tester', phoneNumber: '0701234567',
      email: 'lookup@example.com', password: 'a secure lookup test passphrase' }).expect(201);
  const coordinates = { latitude: 56.05, longitude: 12.69 };
  const post = (body = coordinates) => agent.post('/api/locations/reverse-address')
    .set('Origin', env.appOrigin).set('X-CSRF-Token', csrf.body.csrfToken).send(body);

  await t.test('auth, Origin, CSRF and coordinates are checked before calling Geoapify', async () => {
    await request(app).post('/api/locations/reverse-address').send(coordinates).expect(401);
    await agent.post('/api/locations/reverse-address').set('Origin', env.appOrigin).send(coordinates).expect(403);
    await agent.post('/api/locations/reverse-address').set('Origin', 'https://other.example')
      .set('X-CSRF-Token', csrf.body.csrfToken).send(coordinates).expect(403);
    await post({ ...coordinates, latitude: 91 }).expect(400);
    await post({ ...coordinates, userId: 'other' }).expect(400);
    assert.equal(provider.mock.callCount(), 0);
  });

  await t.test('success returns only the normalized suggestion with no-store caching', async () => {
    const result = await post().expect(200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual(result.body, { address: { addressLine1: 'Testgatan 12', city: 'Helsingborg', postalCode: '25438', countryCode: 'SE' } });
    assert.equal((await pool.query('SELECT 1 FROM addresses')).rowCount, 0);
    assert.equal((await pool.query('SELECT 1 FROM user_address_preferences')).rowCount, 0);
  });

  await t.test('partial Swedish results keep unavailable fields null', async () => {
    provider.mock.mockImplementation(async () => new Response(JSON.stringify({ features: [{ properties: { city: 'Helsingborg', country_code: 'se' } }] })));
    const result = await post().expect(200);
    assert.deepEqual(result.body.address, { addressLine1: null, city: 'Helsingborg', postalCode: null, countryCode: 'SE' });
  });

  await t.test('unsupported country and provider failures return safe errors', async () => {
    provider.mock.mockImplementation(async () => new Response(JSON.stringify({ features: [{ properties: { country_code: 'de', city: 'Berlin' } }] })));
    const unsupported = await post().expect(422);
    assert.match(unsupported.body.message, /Sweden only/);
    provider.mock.mockImplementation(async () => { throw new Error('Private URL with test-key'); });
    const failure = await post().expect(503);
    assert.deepEqual(failure.body, { message: 'Address lookup is temporarily unavailable. Please try again later.' });
  });
});
