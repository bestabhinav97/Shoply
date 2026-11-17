import { apiClient } from '../../../lib/apiClient';

// Planned backend contract. No direct browser calls to a geocoding provider.
export async function reverseGeocode({ latitude, longitude }, signal) {
  const result = await apiClient('/locations/reverse-geocode', {
    method: 'POST', body: { latitude, longitude }, signal,
  });
  if (typeof result?.city !== 'string' || !result.city.trim() || result.city.length > 120) {
    throw new Error('We couldn’t find a city for this location. Please try again.');
  }
  return result.city.trim();
}
