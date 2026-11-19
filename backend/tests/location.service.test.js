import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../config/env.js';
import { findCity, findAddress } from '../modules/locations/location.service.js';

const coordinates = { latitude: 56.05, longitude: 12.69 };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach((t) => {
  const originalKey = env.geoapifyApiKey;
  env.geoapifyApiKey = 'test-key';
  t.after(() => { env.geoapifyApiKey = originalKey; });
});

test('city service builds a city-level request and returns only the trimmed city', async (t) => {
  const provider = t.mock.method(globalThis, 'fetch', async () => json({
    features: [{ properties: { city: ' Helsingborg ', postcode: '25438' } }],
  }));
  assert.deepEqual(await findCity(coordinates), { city: 'Helsingborg' });
  const [url, options] = provider.mock.calls[0].arguments;
  assert.equal(url.origin + url.pathname, 'https://api.geoapify.com/v1/geocode/reverse');
  assert.equal(url.searchParams.get('lat'), '56.05');
  assert.equal(url.searchParams.get('lon'), '12.69');
  assert.equal(url.searchParams.get('type'), 'city');
  assert.equal(url.searchParams.get('format'), 'geojson');
  assert.equal(url.searchParams.get('lang'), 'sv');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.ok(url.searchParams.get('apiKey'));
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.redirect, 'error');
});

test('city service skips the provider when no key is configured', async (t) => {
  env.geoapifyApiKey = '';
  const provider = t.mock.method(globalThis, 'fetch', async () => {});
  await assert.rejects(findCity(coordinates), { status: 503 });
  await assert.rejects(findAddress(coordinates), { status: 503 });
  assert.equal(provider.mock.callCount(), 0);
});

test('city service safely handles HTTP errors, network failures and malformed responses', async (t) => {
  const provider = t.mock.method(globalThis, 'fetch');
  for (const implementation of [
    async () => json({ message: 'Private provider detail' }, 429),
    async () => json({}, 500),
    async () => { throw new Error('URL containing private key'); },
    async () => new Response('invalid json'),
    async () => json({ unexpected: true }),
  ]) {
    provider.mock.mockImplementation(implementation);
    await assert.rejects(findCity(coordinates), {
      status: 503, message: 'City lookup is temporarily unavailable. Please try again later.',
    });
    await assert.rejects(findAddress(coordinates), {
      status: 503, message: 'Address lookup is temporarily unavailable. Please try again later.',
    });
  }
});

test('city service rejects empty, missing or invalid city results', async (t) => {
  const provider = t.mock.method(globalThis, 'fetch');
  for (const features of [[], [{ properties: {} }], ...['', ' ', 123, 'x'.repeat(121), 'City\nName']
    .map((city) => [{ properties: { city } }])]) {
    provider.mock.mockImplementation(async () => json({ features }));
    await assert.rejects(findCity(coordinates), { status: 422 });
  }
});

test('city service applies an eight-second deadline and safely handles its abort', async (t) => {
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 8000);
    return AbortSignal.abort(new DOMException('Deadline reached', 'TimeoutError'));
  });
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => { signal.throwIfAborted(); });
  await assert.rejects(findCity(coordinates), { status: 503 });
  await assert.rejects(findAddress(coordinates), { status: 503 });
});

test('full-address lookup requests address details and returns only normalized form fields', async (t) => {
  const provider = t.mock.method(globalThis, 'fetch', async () => json({ features: [{ properties: {
    street: ' Testgatan ', housenumber: ' 12 ', city: ' Helsingborg ', postcode: '254 38', country_code: 'se',
    formatted: 'Extra private address details', state: 'Skåne', lat: 56.05, lon: 12.69,
  } }] }));
  assert.deepEqual(await findAddress(coordinates), { address: {
    addressLine1: 'Testgatan 12', city: 'Helsingborg', postalCode: '25438', countryCode: 'SE',
  } });
  const [url] = provider.mock.calls[0].arguments;
  assert.equal(url.searchParams.has('type'), false);
  assert.equal(url.searchParams.get('lat'), '56.05');
  assert.equal(url.searchParams.get('lon'), '12.69');
  assert.equal(url.searchParams.get('format'), 'geojson');
});

test('full-address lookup returns null for missing or unusable fields without inventing details', async (t) => {
  const provider = t.mock.method(globalThis, 'fetch', async () => json({ features: [{ properties: {
    country_code: 'se', city: 'Helsingborg', postcode: 'bad', housenumber: '12',
  } }] }));
  assert.deepEqual(await findAddress(coordinates), { address: {
    addressLine1: null, city: 'Helsingborg', postalCode: null, countryCode: 'SE',
  } });
  provider.mock.mockImplementation(async () => json({ features: [{ properties: {
    country_code: 'SE', street: 'Testgatan', city: 'Bad\nCity', postcode: 25438,
  } }] }));
  assert.deepEqual(await findAddress(coordinates), { address: {
    addressLine1: 'Testgatan', city: null, postalCode: null, countryCode: 'SE',
  } });
});

test('full-address lookup rejects foreign, unknown-country and wholly unusable results', async (t) => {
  const provider = t.mock.method(globalThis, 'fetch');
  for (const features of [[], [{ properties: { country_code: 'DE', city: 'Berlin' } }],
    [{ properties: { city: 'Helsingborg' } }], [{ properties: { country_code: 'SE', formatted: 'Not a structured address' } }],
    [{ properties: { country_code: 'SE', city: 'x'.repeat(101) } }]]) {
    provider.mock.mockImplementation(async () => json({ features }));
    await assert.rejects(findAddress(coordinates), { status: 422 });
  }
});
