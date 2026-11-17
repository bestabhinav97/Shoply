import { env } from '../../config/env.js';
import { httpError } from '../../shared/errors.js';

export async function findCity({ latitude, longitude }) {
  if (!env.geoapifyApiKey) {
    throw httpError(503, 'City lookup is temporarily unavailable. Please try again later.');
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    apiKey: env.geoapifyApiKey,
    type: 'city',
    format: 'geojson',
    lang: 'sv',
    limit: '1',
  }).toString();

  let data;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Geocoding provider failed.');
    data = await response.json();
  } catch {
    // Provider errors may contain the URL/key. Expose only our own safe message.
    throw httpError(503, 'City lookup is temporarily unavailable. Please try again later.');
  }

  if (!Array.isArray(data?.features)) {
    throw httpError(503, 'City lookup is temporarily unavailable. Please try again later.');
  }
  const city = data.features[0]?.properties?.city;
  if (typeof city !== 'string' || !city.trim() || city.trim().length > 120
    || /[\p{Cc}\p{Cf}]/u.test(city)) {
    throw httpError(422, 'We couldn’t find a city for this location. Please try another location.');
  }
  return { city: city.trim() };
}
