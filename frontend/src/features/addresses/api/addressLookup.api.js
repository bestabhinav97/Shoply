import { apiClient } from '../../../lib/apiClient';

// Separate contract from the header's city-only endpoint; no direct provider calls.
export async function lookupAddress(coordinates, signal) {
  const result = await apiClient('/locations/reverse-address', { method: 'POST', body: coordinates, signal });
  const address = result?.address;
  if (!address || typeof address.countryCode !== 'string') throw new Error('The address lookup returned an incomplete response. Please enter your address manually.');
  if (address.countryCode !== 'SE') throw new Error('Location autofill currently supports delivery addresses in Sweden only.');
  const suggestion = {};
  for (const [field, maxLength] of [['addressLine1', 200], ['city', 100], ['postalCode', 5]]) {
    const value = address[field];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || value.length > maxLength || /[\p{Cc}\p{Cf}]/u.test(value)
      || (field === 'postalCode' && !/^[0-9]{5}$/.test(value))) {
      throw new Error('The address lookup returned invalid details. Please enter your address manually.');
    }
    if (value.trim()) suggestion[field] = value.trim();
  }
  if (!Object.keys(suggestion).length) throw new Error('No address details were found. Please enter your address manually.');
  return suggestion;
}
