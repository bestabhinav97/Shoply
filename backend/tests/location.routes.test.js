import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { env } from '../config/env.js';

test('location route connects guests to validation and the city service', async (t) => {
  const originalKey = env.geoapifyApiKey;
  env.geoapifyApiKey = 'test-key';
  t.after(() => { env.geoapifyApiKey = originalKey; });
  const provider = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    features: [{ properties: { city: 'Helsingborg', street: 'Private street' } }],
  })));
  const guest = request.agent(app);
  const csrf = await guest.get('/api/auth/csrf').expect(200);
  const coordinates = { latitude: 56.05, longitude: 12.69 };
  const post = (body) => guest.post('/api/locations/reverse-geocode')
    .set('Origin', env.appOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send(body);

  await t.test('guests receive only the city without signing in', async () => {
    const result = await post(coordinates).expect(200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual(result.body, { city: 'Helsingborg' });
  });

  await t.test('invalid coordinates reach the existing error handler', async () => {
    const calls = provider.mock.callCount();
    const result = await post({ ...coordinates, latitude: 91 }).expect(400);
    assert.equal(result.body.message, 'Please provide valid coordinates.');
    assert.equal(typeof result.body.fields.latitude, 'string');
    assert.equal(provider.mock.callCount(), calls);
  });

  await t.test('missing CSRF and incorrect Origin are rejected', async () => {
    const calls = provider.mock.callCount();
    await guest.post('/api/locations/reverse-geocode')
      .set('Origin', env.appOrigin).send(coordinates).expect(403);
    await guest.post('/api/locations/reverse-geocode')
      .set('Origin', 'https://other.example')
      .set('X-CSRF-Token', csrf.body.csrfToken).send(coordinates).expect(403);
    assert.equal(provider.mock.callCount(), calls);
  });

  await t.test('provider failure preserves a safe 503 response', async () => {
    provider.mock.mockImplementation(async () => { throw new Error('Sensitive provider detail test-key'); });
    const result = await post(coordinates).expect(503);
    assert.deepEqual(result.body, { message: 'City lookup is temporarily unavailable. Please try again later.' });
    assert.equal(result.headers['cache-control'], 'no-store');
  });

  await t.test('an empty result returns a useful 422 response', async () => {
    provider.mock.mockImplementation(async () => new Response(JSON.stringify({ features: [] })));
    const result = await post(coordinates).expect(422);
    assert.match(result.body.message, /couldn’t find a city/);
  });
});
