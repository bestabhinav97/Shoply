import { env } from '../../config/env.js';
import { httpError } from '../../shared/errors.js';

async function requestGeocoding({ latitude, longitude }, { type, label }) {
  const unavailable = `${label} lookup is temporarily unavailable. Please try again later.`;
  if (!env.geoapifyApiKey) {
    throw httpError(503, unavailable);
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    apiKey: env.geoapifyApiKey,
    ...(type && { type }),
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
    throw httpError(503, unavailable);
  }

  if (!Array.isArray(data?.features)) {
    throw httpError(503, unavailable);
  }
  return data.features[0]?.properties;
}

export async function findCity(coordinates) {
  const properties = await requestGeocoding(coordinates, { type: 'city', label: 'City' });
  const city = properties?.city;
  if (typeof city !== 'string' || !city.trim() || city.trim().length > 120
    || /[\p{Cc}\p{Cf}]/u.test(city)) {
    throw httpError(422, 'We couldn’t find a city for this location. Please try another location.');
  }
  return { city: city.trim() };
}

function optionalText(value, maxLength) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

export async function findAddress(coordinates) {
  // Omitting type requests address-level details instead of city-only results.
  const properties = await requestGeocoding(coordinates, { label: 'Address' });
  if (!properties) throw httpError(422, 'No address details were found. Please enter your address manually.');
  const countryCode = optionalText(properties.country_code, 2)?.toUpperCase();
  if (!countryCode) throw httpError(422, 'We couldn’t determine the delivery country. Please enter your address manually.');
  if (countryCode !== 'SE') throw httpError(422, 'Location autofill currently supports delivery addresses in Sweden only.');

  const street = optionalText(properties.street, 200);
  const houseNumber = optionalText(properties.housenumber, 50);
  const postcode = optionalText(properties.postcode, 6);
  const address = {
    addressLine1: street ? optionalText([street, houseNumber].filter(Boolean).join(' '), 200) : null,
    city: optionalText(properties.city, 100),
    postalCode: postcode && /^[0-9]{3} ?[0-9]{2}$/.test(postcode) ? postcode.replace(' ', '') : null,
    countryCode,
  };
  if (!address.addressLine1 && !address.city && !address.postalCode) {
    throw httpError(422, 'No address details were found. Please enter your address manually.');
  }
  return { address };
}
