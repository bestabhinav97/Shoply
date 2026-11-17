import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/app/App';

let user;
let rejectSave;
let pendingSave;
let calls;
beforeEach(() => {
  user = { id: 'account-user', firstName: 'Ada', lastName: 'Test', email: 'ada@example.com', phoneNumber: '+46701234567', role: 'customer' };
  rejectSave = false; pendingSave = null; calls = [];
  window.history.replaceState({}, '', '/account');
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    calls.push({ url, options });
    const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
    if (url === '/api/auth/me' && options.method === 'PATCH') {
      if (pendingSave) await pendingSave;
      if (rejectSave) return response({ message: 'This email is already in use.', fields: { email: 'This email is already in use.' } }, 409);
      user = { ...user, ...JSON.parse(options.body) };
      return response({ user });
    }
    if (url === '/api/auth/me') return user ? response({ user }) : response({ message: 'Sign in' }, 401);
    if (url === '/api/auth/csrf') return response({ csrfToken: 'test-csrf' });
    if (url === '/api/auth/logout' || url === '/api/auth/logout-all') { user = null; return response({ message: 'Signed out.' }); }
    if (url === '/api/categories') return response({ items: [] });
    if (url === '/api/cart') return response({ items: [], itemCount: 0 });
    throw new Error(`Unexpected request: ${url}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

test('account defaults to Profile and navigation has linkable placeholder routes', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Profile', exact: true });
  expect(window.location.pathname).toBe('/account/profile');
  const nav = screen.getByRole('navigation', { name: 'Account navigation' });
  expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
  for (const [name, path, empty] of [['Addresses', 'addresses', 'No addresses yet.'], ['Payment methods', 'payment-methods', 'No payment methods yet.'], ['Orders', 'orders', 'No orders yet.']]) {
    await userEvent.click(within(nav).getByRole('link', { name }));
    expect(window.location.pathname).toBe(`/account/${path}`);
    expect(screen.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(screen.getByText(empty)).toBeVisible();
    expect(within(nav).getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(`Home/Account/${name}`);
  }
  expect(calls.filter(({ options }) => options.method && options.method !== 'GET')).toHaveLength(0);
});

test.each(['profile', 'addresses', 'payment-methods', 'orders'])('direct account/%s route loads and is protected', async (tab) => {
  user = null;
  window.history.replaceState({}, '', `/account/${tab}`);
  render(<App />);
  await screen.findByRole('heading', { name: 'Welcome back.' });
  expect(window.location.search).toBe(`?next=%2Faccount%2F${tab}`);
});

test.each([['addresses', 'Addresses'], ['payment-methods', 'Payment methods'], ['orders', 'Orders']])('signed-in direct account/%s route survives a fresh mount', async (path, title) => {
  window.history.replaceState({}, '', `/account/${path}`);
  render(<App />);
  expect(await screen.findByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('email edit validates, reports server errors, saves and persists after remount', async () => {
  const view = render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Edit email' }));
  const input = screen.getByLabelText('Email');
  await userEvent.clear(input); await userEvent.type(input, 'bad');
  await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
  await userEvent.clear(input); await userEvent.type(input, 'new@example.com');
  rejectSave = true;
  await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already in use');
  rejectSave = false;
  let resolve;
  pendingSave = new Promise((done) => { resolve = done; });
  await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  expect(await screen.findByRole('button', { name: /Saving/ })).toBeDisabled();
  resolve();
  expect(await screen.findByText('Email saved.')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Profile' })).getByText('new@example.com')).toBeVisible();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit email' })).toHaveFocus());
  const save = calls.find(({ options }) => options.method === 'PATCH');
  expect(save.options.credentials).toBe('include');
  expect(save.options.headers['X-CSRF-Token']).toBe('test-csrf');
  view.unmount(); render(<App />);
  expect(await within(await screen.findByRole('region', { name: 'Profile' })).findByText('new@example.com')).toBeVisible();
});

test('missing values offer Add actions, international phones validate and cancel discards edits', async () => {
  user.email = ''; user.phoneNumber = '';
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Add email' })).toBeVisible();
  expect(screen.getAllByText('Not added')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Add phone number' }));
  const input = screen.getByLabelText('Phone number');
  await userEvent.type(input, '0701234567');
  await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('international phone number');
  await userEvent.clear(input); await userEvent.type(input, '+1 202 555 0123');
  await userEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  expect(await screen.findByText('+12025550123')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Edit phone number' }));
  await userEvent.clear(screen.getByLabelText('Phone number'));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('+12025550123')).toBeVisible();
  expect(calls.filter(({ options }) => options.method === 'PATCH')).toHaveLength(1);
});


test('verification explains availability without making a request or changing status', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Verify now' }));
  const dialog = screen.getByRole('dialog', { name: 'Contact verification' });
  expect(within(dialog).getByText(/aren't available yet/)).toBeVisible();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getAllByText('Unverified')).toHaveLength(2);
  expect(calls.filter(({ options }) => options.method && options.method !== 'GET')).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Verify', exact: true }));
  expect(screen.getByRole('dialog', { name: 'Contact verification' })).toBeVisible();
});

test('sign out everywhere requires confirmation and cancel keeps the session', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out on all devices' }));
  let dialog = screen.getByRole('dialog', { name: 'Sign out on all devices?' });
  expect(calls.some(({ url }) => url === '/api/auth/logout-all')).toBe(false);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls.some(({ url }) => url === '/api/auth/logout-all')).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'Sign out on all devices' }));
  dialog = screen.getByRole('dialog', { name: 'Sign out on all devices?' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }));
  await waitFor(() => expect(calls.filter(({ url }) => url === '/api/auth/logout-all')).toHaveLength(1));
  expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});

test('sign out of this device uses the existing session endpoint', async () => {
  render(<App />);
  const sessions = await screen.findByRole('region', { name: 'Sessions' });
  await userEvent.click(within(sessions).getByRole('button', { name: 'Sign out', exact: true }));
  await waitFor(() => expect(calls.filter(({ url }) => url === '/api/auth/logout')).toHaveLength(1));
  expect(calls.some(({ url }) => url === '/api/auth/logout-all')).toBe(false);
});
