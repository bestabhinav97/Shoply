import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddressForm } from '../src/features/addresses/components/AddressForm';

const customer = { id: 'customer', firstName: 'Ada', lastName: 'Test', phoneNumber: '+46701234567' };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
let getPosition, lookupResult, lookupStatus, writes;

beforeEach(() => {
  sessionStorage.clear();
  lookupResult = { address: { addressLine1: 'Testgatan 12', city: 'Helsingborg', postalCode: '25438', countryCode: 'SE' } };
  lookupStatus = 200; writes = [];
  getPosition = vi.fn((success) => success({ coords: { latitude: 56.05, longitude: 12.69 } }));
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: getPosition } });
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/csrf') return response({ csrfToken: 'test-csrf' });
    if (url === '/api/locations/reverse-address') return response(lookupResult, lookupStatus);
    if (url === '/api/addresses') {
      writes.push(JSON.parse(options.body));
      return response({ items: [], defaultAddressId: null, selectedAddressId: null }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => vi.unstubAllGlobals());

function mount(address) {
  const client = new QueryClient();
  client.setQueryData(['auth', 'user'], customer);
  const onSaved = vi.fn();
  return { ...render(<QueryClientProvider client={client}><AddressForm user={customer} address={address} onSaved={onSaved} onCancel={vi.fn()} /></QueryClientProvider>), onSaved };
}

test('autofill is explicit, sends only coordinates and never saves without Save', async () => {
  const { onSaved } = mount();
  expect(getPosition).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Apartment or address line 2 (optional)'), 'Apartment 4');
  await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  await waitFor(() => expect(screen.getByLabelText('City', { exact: true })).toHaveValue('Helsingborg'));
  expect(screen.getByLabelText('Street and house number')).toHaveValue('Testgatan 12');
  expect(screen.getByLabelText('Postcode')).toHaveValue('25438');
  expect(screen.getByLabelText('Recipient name')).toHaveValue('Ada Test');
  expect(screen.getByLabelText('Phone number')).toHaveValue('+46701234567');
  expect(screen.getByLabelText('Apartment or address line 2 (optional)')).toHaveValue('Apartment 4');
  expect(fetch).toHaveBeenCalledWith('/api/locations/reverse-address', expect.objectContaining({
    method: 'POST', credentials: 'include', body: JSON.stringify({ latitude: 56.05, longitude: 12.69 }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-csrf' },
  }));
  expect(writes).toHaveLength(0);
  expect(sessionStorage.length).toBe(0);
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(writes[0].addressLine2).toBe('Apartment 4');
});

test('editing asks before replacement, supports keeping details and preserves fields missing in the response', async () => {
  lookupResult.address = { addressLine1: null, city: 'Stockholm', postalCode: null, countryCode: 'SE' };
  mount({ id: 'address-1', recipientName: 'Other Recipient', phoneNumber: '+442079460018',
    addressLine1: 'Old street 8', addressLine2: 'Apartment 2', postalCode: '25438', city: 'Helsingborg' });
  await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('group', { name: 'Replace address fields?' })).toBeVisible();
  expect(screen.getByLabelText('City', { exact: true })).toHaveValue('Helsingborg');
  expect(screen.getByRole('button', { name: 'Save address' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Keep my address' }));
  expect(screen.getByLabelText('City', { exact: true })).toHaveValue('Helsingborg');
  await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Replace address fields' }));
  expect(screen.getByLabelText('City', { exact: true })).toHaveValue('Stockholm');
  expect(screen.getByLabelText('Street and house number')).toHaveValue('Old street 8');
  expect(screen.getByLabelText('Postcode')).toHaveValue('25438');
  expect(screen.getByLabelText('Recipient name')).toHaveValue('Other Recipient');
  expect(screen.getByLabelText('Apartment or address line 2 (optional)')).toHaveValue('Apartment 2');
  expect(writes).toHaveLength(0);
});

test.each([1, 2, 3])('device failure %s leaves manual entry usable and makes no API call', async (code) => {
  getPosition.mockImplementation((_success, failure) => failure({ code }));
  mount();
  await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByLabelText('City', { exact: true })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save address' })).toBeEnabled();
  expect(fetch).not.toHaveBeenCalled();
});

test('missing endpoint clearly explains the frontend-only state and preserves input', async () => {
  lookupResult = { message: 'Route not found' }; lookupStatus = 404;
  mount();
  await userEvent.type(screen.getByLabelText('City', { exact: true }), 'Helsingborg');
  await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Address autofill isn’t connected yet');
  expect(screen.getByLabelText('City', { exact: true })).toHaveValue('Helsingborg');
});

test.each([
  { addressLine1: null, city: 'Berlin', postalCode: '10115', countryCode: 'DE' },
  { addressLine1: null, city: null, postalCode: null, countryCode: 'SE' },
  { addressLine1: null, city: 'Bad\nCity', postalCode: null, countryCode: 'SE' },
])('unsupported or unusable results never overwrite the form', async (address) => {
  lookupResult = { address };
  mount();
  await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByLabelText('City', { exact: true })).toHaveValue('');
  expect(writes).toHaveLength(0);
});

test('pending lookup disables Save and ignores a late location callback after unmount', async () => {
  let resolvePosition;
  getPosition.mockImplementation((success) => { resolvePosition = success; });
  const view = mount();
  await userEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(screen.getByRole('button', { name: 'Save address' })).toBeDisabled();
  fireEvent.submit(screen.getByRole('form', { name: 'Add delivery address' }));
  expect(writes).toHaveLength(0);
  view.unmount();
  await act(async () => resolvePosition({ coords: { latitude: 56.05, longitude: 12.69 } }));
  expect(fetch).not.toHaveBeenCalled();
});
