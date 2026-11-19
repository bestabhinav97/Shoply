import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DeliveryLocation } from '../src/features/delivery';
import { AccountAddresses } from '../src/features/addresses';

const customer = { id: 'customer', firstName: 'Ada', lastName: 'Test', phoneNumber: '+46701234567' };
const address = { id: 'address-1', recipientName: 'Ada Test', phoneNumber: '+46701234567', addressLine1: 'Testgatan 12', addressLine2: '', postalCode: '25438', city: 'Helsingborg', countryCode: 'SE' };
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
let snapshot, unavailable, writes, pendingDefault, rejectDefault, pendingRemove, rejectManage;

beforeEach(() => {
  snapshot = { items: [], selectedAddressId: null, defaultAddressId: null };
  unavailable = false; writes = [];
  pendingDefault = null; rejectDefault = false;
  pendingRemove = null; rejectManage = false;
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/csrf') return response({ csrfToken: 'test-csrf' });
    if (url.startsWith('/api/addresses')) {
      if (options.method !== 'GET' && options.method) writes.push({ url, options, body: JSON.parse(options.body) });
      if (unavailable) return response({ message: 'Route not found' }, 404);
      if (options.method === 'POST') {
        const { selectForDelivery, isDefault, ...details } = JSON.parse(options.body);
        const created = { id: 'address-2', ...details };
        snapshot = { items: [...snapshot.items, created], defaultAddressId: isDefault || !snapshot.items.length ? created.id : snapshot.defaultAddressId,
          selectedAddressId: selectForDelivery ? created.id : snapshot.selectedAddressId };
      }
      if (url === '/api/addresses/default') {
        if (pendingDefault) await pendingDefault;
        if (rejectDefault) return response({ message: 'Could not change your default address.' }, 503);
        snapshot = { ...snapshot, defaultAddressId: JSON.parse(options.body).addressId };
      } else if (url === '/api/addresses/selected') snapshot = { ...snapshot, selectedAddressId: JSON.parse(options.body).addressId };
      else if (options.method === 'PATCH') {
        if (rejectManage) return response({ message: 'Address update failed.' }, 503);
        const id = url.split('/').at(-1);
        snapshot = { ...snapshot, items: snapshot.items.map((item) => item.id === id ? { id, ...JSON.parse(options.body) } : item) };
      } else if (options.method === 'DELETE') {
        if (pendingRemove) await pendingRemove;
        if (rejectManage) return response({ message: 'Address removal failed.' }, 503);
        const id = url.split('/').at(-1);
        const items = snapshot.items.filter((item) => item.id !== id);
        snapshot = { items, defaultAddressId: snapshot.defaultAddressId === id ? items[0]?.id ?? null : snapshot.defaultAddressId,
          selectedAddressId: snapshot.selectedAddressId === id ? null : snapshot.selectedAddressId };
      }
      return response(snapshot, options.method === 'POST' ? 201 : 200);
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => vi.unstubAllGlobals());

function mount(account = false, withHeader = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth', 'user'], customer);
  return render(<QueryClientProvider client={client}><MemoryRouter>
    {withHeader && <DeliveryLocation user={customer} />}
    {account ? <AccountAddresses /> : <DeliveryLocation user={customer} />}
  </MemoryRouter></QueryClientProvider>);
}

async function openForm(account = false) {
  if (!account) await userEvent.click(screen.getByRole('button', { name: /Deliver to Choose an address/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Add address' }));
}

async function fillAddress() {
  await userEvent.type(screen.getByLabelText('Street and house number'), 'Testgatan 12');
  await userEvent.type(screen.getByLabelText('Postcode'), '254 38');
  await userEvent.type(screen.getByLabelText('City', { exact: true }), 'Helsingborg');
}

test('chooser prefills identity and saves using the agreed JSON and CSRF contract', async () => {
  mount(); await openForm();
  expect(screen.getByLabelText('Recipient name')).toHaveValue('Ada Test');
  expect(screen.getByLabelText('Phone number')).toHaveValue('+46701234567');
  await fillAddress();
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  expect(await screen.findByText('Address saved.')).toBeVisible();
  expect(screen.getByRole('button', { name: /Deliver to Helsingborg/ })).toBeVisible();
  expect(writes[0].body).toEqual({
    recipientName: 'Ada Test', phoneNumber: '+46701234567', addressLine1: 'Testgatan 12', addressLine2: '',
    postalCode: '25438', city: 'Helsingborg', countryCode: 'SE', isDefault: false, selectForDelivery: true,
  });
  expect(writes[0].options.credentials).toBe('include');
  expect(writes[0].options.headers['X-CSRF-Token']).toBe('test-csrf');
  expect(sessionStorage.getItem('shoply.guest-city')).toBeNull();
});

test('account form saves without changing an existing delivery selection', async () => {
  snapshot = { items: [address], defaultAddressId: address.id, selectedAddressId: address.id };
  mount(true); await openForm(true); await fillAddress();
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  expect(await screen.findByText('Address saved.')).toBeVisible();
  expect(writes[0].body.selectForDelivery).toBe(false);
  expect(snapshot.selectedAddressId).toBe(address.id);
  expect(screen.getAllByText('Testgatan 12')).toHaveLength(2);
});

test('missing backend permits form preview but never claims an address was saved', async () => {
  unavailable = true;
  mount(); await openForm(); await fillAddress();
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  expect(await within(screen.getByRole('dialog', { name: 'Add a delivery address' })).findByRole('alert')).toHaveTextContent('Your details have not been saved');
  expect(screen.getByLabelText('City', { exact: true })).toHaveValue('Helsingborg');
  expect(screen.queryByText('Address saved.')).not.toBeInTheDocument();
});

test('form validates before calling the API and focuses the invalid input', async () => {
  mount(true); await openForm(true);
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  expect(screen.getByLabelText('Street and house number')).toHaveFocus();
  expect(screen.getByLabelText('Postcode')).toHaveAttribute('aria-invalid', 'true');
  expect(writes).toHaveLength(0);
});

test('choosing a saved address changes the header only after confirmation and preserves the default', async () => {
  snapshot = { items: [address, { ...address, id: 'address-2', city: 'Stockholm' }], defaultAddressId: address.id, selectedAddressId: address.id };
  mount();
  await userEvent.click(await screen.findByRole('button', { name: /Deliver to Helsingborg/ }));
  const radios = await screen.findAllByRole('radio');
  await userEvent.click(radios[1]);
  expect(screen.getByRole('button', { name: /Deliver to Helsingborg/ })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Use this address' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: /Deliver to Stockholm/ })).toBeVisible();
  expect(snapshot.defaultAddressId).toBe(address.id);
  expect(writes[0].url).toBe('/api/addresses/selected');
  expect(writes[0].body).toEqual({ addressId: 'address-2' });
});

test('cancel returns to the address list without saving', async () => {
  mount(true); await openForm(true);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByRole('button', { name: 'Add address' })).toHaveFocus();
  expect(screen.queryByLabelText('Street and house number')).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

test('set default waits for confirmation, updates the card label and preserves selection', async () => {
  snapshot = { items: [address, { ...address, id: 'address-2', city: 'Stockholm' }], defaultAddressId: address.id, selectedAddressId: address.id };
  let release;
  pendingDefault = new Promise((resolve) => { release = resolve; });
  mount(true);
  const button = await screen.findByRole('button', { name: 'Set Testgatan 12, Stockholm as default' });
  await userEvent.click(button);
  expect(button).toBeDisabled();
  expect(within(screen.getByRole('article', { name: 'Ada Test, Helsingborg' })).getByText('Default')).toBeVisible();
  await act(async () => release());
  expect(await screen.findByText('Default address updated.')).toBeVisible();
  expect(within(screen.getByRole('article', { name: 'Ada Test, Stockholm' })).getByText('Default')).toBeVisible();
  expect(snapshot.selectedAddressId).toBe(address.id);
  expect(writes[0].url).toBe('/api/addresses/default');
  expect(writes[0].body).toEqual({ addressId: 'address-2' });
  expect(writes[0].options.headers['X-CSRF-Token']).toBe('test-csrf');
  expect(writes[0].options.credentials).toBe('include');
});

test('failed default updates retain the original default and allow retry', async () => {
  snapshot = { items: [address, { ...address, id: 'address-2', city: 'Stockholm' }], defaultAddressId: address.id, selectedAddressId: address.id };
  rejectDefault = true;
  mount(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Set Testgatan 12, Stockholm as default' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not change your default address');
  expect(snapshot.defaultAddressId).toBe(address.id);
  rejectDefault = false;
  await userEvent.click(screen.getByRole('button', { name: 'Set Testgatan 12, Stockholm as default' }));
  expect(await screen.findByText('Default address updated.')).toBeVisible();
});

test('edit prefills saved details and updates the same address and header without preference commands', async () => {
  snapshot = { items: [address], defaultAddressId: address.id, selectedAddressId: address.id };
  mount(true, true);
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Testgatan 12, Helsingborg' }));
  expect(screen.getByLabelText('City', { exact: true })).toHaveValue('Helsingborg');
  expect(screen.getByLabelText('Street and house number')).toHaveValue('Testgatan 12');
  expect(screen.queryByLabelText('Make this my default address')).not.toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('City', { exact: true }));
  await userEvent.type(screen.getByLabelText('City', { exact: true }), 'Stockholm');
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  expect(await screen.findByText('Address updated.')).toBeVisible();
  expect(screen.getByRole('button', { name: /Deliver to Stockholm/ })).toBeVisible();
  expect(writes[0].url).toBe('/api/addresses/address-1');
  expect(writes[0].options.method).toBe('PATCH');
  expect(writes[0].body.city).toBe('Stockholm');
  expect(writes[0].body).not.toHaveProperty('isDefault');
  expect(writes[0].body).not.toHaveProperty('selectForDelivery');
  expect(snapshot.defaultAddressId).toBe(address.id);
  expect(snapshot.selectedAddressId).toBe(address.id);
});

test('edit cancellation sends no write; failed edit retains entered values and permits retry', async () => {
  snapshot = { items: [address], defaultAddressId: address.id, selectedAddressId: address.id };
  mount(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Testgatan 12, Helsingborg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(writes).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Edit Testgatan 12, Helsingborg' }));
  await userEvent.type(screen.getByLabelText('Apartment or address line 2 (optional)'), 'Apartment 4');
  rejectManage = true;
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Address update failed');
  expect(screen.getByLabelText('Apartment or address line 2 (optional)')).toHaveValue('Apartment 4');
  expect(snapshot.items[0].addressLine2).toBe('');
  rejectManage = false;
  await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
  expect(await screen.findByText('Address updated.')).toBeVisible();
});

test('remove requires confirmation, supports cancellation, waits for success and updates fallback/header', async () => {
  snapshot = { items: [address, { ...address, id: 'address-2', city: 'Stockholm' }], defaultAddressId: address.id, selectedAddressId: address.id };
  mount(true, true);
  await userEvent.click(await screen.findByRole('button', { name: 'Remove Testgatan 12, Helsingborg' }));
  let dialog = screen.getByRole('dialog', { name: 'Remove address?' });
  expect(within(dialog).getByText('Testgatan 12')).toBeVisible();
  expect(within(dialog).getByText(/oldest remaining address/)).toBeVisible();
  expect(writes).toHaveLength(0);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Remove Testgatan 12, Helsingborg' }));
  dialog = screen.getByRole('dialog', { name: 'Remove address?' });
  let release;
  pendingRemove = new Promise((resolve) => { release = resolve; });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Remove address' }));
  expect(within(dialog).getByRole('button', { name: 'Remove address' })).toBeDisabled();
  expect(screen.getByRole('article', { name: 'Ada Test, Helsingborg' })).toBeInTheDocument();
  await act(async () => release());
  expect(await screen.findByText('Address removed.')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('article', { name: 'Ada Test, Helsingborg' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Deliver to Stockholm/ })).toBeVisible();
  expect(snapshot.defaultAddressId).toBe('address-2');
  expect(snapshot.selectedAddressId).toBeNull();
  expect(writes[0].options.method).toBe('DELETE');
  expect(writes[0].options.headers['X-CSRF-Token']).toBe('test-csrf');
});

test('failed removal keeps the card and confirmation; retrying the last address empties the book', async () => {
  snapshot = { items: [address], defaultAddressId: address.id, selectedAddressId: address.id };
  mount(true);
  await userEvent.click(await screen.findByRole('button', { name: 'Remove Testgatan 12, Helsingborg' }));
  rejectManage = true;
  await userEvent.click(screen.getByRole('button', { name: 'Remove address' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Address removal failed');
  expect(screen.getByRole('article', { name: 'Ada Test, Helsingborg' })).toBeInTheDocument();
  rejectManage = false;
  await userEvent.click(screen.getByRole('button', { name: 'Remove address' }));
  expect(await screen.findByText('Address removed.')).toBeVisible();
  expect(screen.getByText(/No saved addresses yet/)).toBeVisible();
  expect(snapshot).toEqual({ items: [], defaultAddressId: null, selectedAddressId: null });
});
