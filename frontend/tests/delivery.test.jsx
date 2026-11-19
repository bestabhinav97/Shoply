import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DeliveryLocation } from '../src/features/delivery';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
let getPosition;

function Path() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}{location.search}{location.hash}</output>;
}

function mount(props = {}, path = '/products?category=home') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (props.user) client.setQueryData(['auth', 'user'], props.user);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><DeliveryLocation {...props} /><Path /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  sessionStorage.clear();
  getPosition = vi.fn((success) => success({ coords: { latitude: 56.05, longitude: 12.69 } }));
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: getPosition } });
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url === '/api/auth/csrf') return response({ csrfToken: 'test-csrf' });
    if (url === '/api/addresses') return response({ items: [], defaultAddressId: null, selectedAddressId: null });
    if (url === '/api/locations/reverse-geocode') return response({ city: 'Helsingborg' });
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => vi.unstubAllGlobals());

test('guest chooser waits for a deliberate click before requesting location', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: /Deliver to Choose location/ }));
  expect(screen.getByRole('dialog', { name: 'Choose your delivery location' })).toBeVisible();
  expect(getPosition).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in to your account' })).toHaveAttribute('href',
    `/login?next=${encodeURIComponent('/products?category=home#delivery-location')}`);

  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  await screen.findByRole('button', { name: /Deliver to Helsingborg/ });
  expect(fetch).toHaveBeenCalledWith('/api/locations/reverse-geocode', expect.objectContaining({
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-csrf' },
    body: JSON.stringify({ latitude: 56.05, longitude: 12.69 }),
  }));
  expect(sessionStorage.getItem('shoply.guest-city')).toBe('Helsingborg');
  expect(sessionStorage.length).toBe(1);
});

test('permission denial explains recovery without calling the API', async () => {
  getPosition.mockImplementation((success, failure) => failure({ code: 1 }));
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: /Deliver to Choose location/ }));
  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('permission was denied');
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'Sign in to your account' })).toBeVisible();
});

test('unimplemented backend reports an honest unavailable state and permits retry', async () => {
  fetch.mockImplementation(async (url) => url === '/api/auth/csrf'
    ? response({ csrfToken: 'test-csrf' }) : response({ message: 'Route not found' }, 404));
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: /Deliver to Choose location/ }));
  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('City lookup isn’t available yet');
  expect(screen.getByRole('button', { name: 'Use my current location' })).toBeEnabled();
  expect(sessionStorage.length).toBe(0);
});

test('closing while device location is pending ignores its late callback', async () => {
  let resolvePosition;
  getPosition.mockImplementation((success) => { resolvePosition = success; });
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: /Deliver to Choose location/ }));
  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(screen.getByRole('button', { name: 'Detecting your location...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Detecting your location...' })).toHaveAttribute('aria-busy', 'true');
  await user.click(screen.getByRole('button', { name: 'Close dialog' }));
  await act(async () => resolvePosition({ coords: { latitude: 56, longitude: 12 } }));
  expect(fetch).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});

test('signed-in return opens chooser with an honest address empty state and account link', async () => {
  const user = userEvent.setup();
  mount({ user: { id: 'customer', firstName: 'Abhinav' } }, '/products#delivery-location');
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('button', { name: /Deliver to Choose an address/ })).toBeVisible();
  expect(await screen.findByText(/No saved addresses yet/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add address' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Use my current location' })).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'Manage addresses' }));
  await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/account/addresses'));
});

test('guest city survives remount without another permission request', () => {
  sessionStorage.setItem('shoply.guest-city', 'Helsingborg');
  mount();
  expect(screen.getByRole('button', { name: /Deliver to Helsingborg/ })).toBeVisible();
  expect(getPosition).not.toHaveBeenCalled();
});

test('success confirms the city, Done closes, and reopening preserves the city', async () => {
  const user = userEvent.setup();
  mount({}, '/products#delivery-location');
  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByText('Delivering to Helsingborg')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/products');
  await user.click(screen.getByRole('button', { name: /Deliver to Helsingborg/ }));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(getPosition).toHaveBeenCalledTimes(1);
});

test('signed-in customers see their city as browsing context and can locate again', async () => {
  sessionStorage.setItem('shoply.guest-city', 'Stockholm');
  const user = userEvent.setup();
  mount({ user: { id: 'customer' } });
  await user.click(screen.getByRole('button', { name: /Deliver to Stockholm/ }));
  expect(screen.getByText(/Current delivery city/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByText('Delivering to Helsingborg')).toBeVisible();
});

test('network failures offer a retry that can recover', async () => {
  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: /Deliver to Choose location/ }));
  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Delivering to Helsingborg')).toBeVisible();
});

test('dialog is described, focuses Close, locks scrolling, and restores focus on Escape', async () => {
  const user = userEvent.setup();
  mount();
  const trigger = screen.getByRole('button', { name: /Deliver to Choose location/ });
  await user.click(trigger);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAccessibleDescription('Use your device location to find your city, or sign in to see your saved addresses.');
  expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});

test('padding clicks keep the dialog open and backdrop clicks dismiss it', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: /Deliver to Choose location/ }));
  const dialog = screen.getByRole('dialog');
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 540, top: 100, bottom: 700 });
  fireEvent.click(dialog, { clientX: 110, clientY: 110 });
  expect(dialog).toBeVisible();
  fireEvent.click(dialog, { clientX: 50, clientY: 50 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a stored city suppresses hash reopening until the header selector is clicked', async () => {
  sessionStorage.setItem('shoply.guest-city', 'Helsingborg');
  const user = userEvent.setup();
  mount({}, '/products#delivery-location');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Deliver to Helsingborg/ }));
  expect(screen.getByRole('dialog')).toBeVisible();
  for (const name of ['Geoapify', '© OpenStreetMap contributors']) {
    expect(screen.getByRole('link', { name })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name })).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test.each([2, 3])('unavailable or timed-out device location (%s) offers retry', async (code) => {
  getPosition.mockImplementation((success, failure) => failure({ code }));
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: /Deliver to Choose location/ }));
  await user.click(screen.getByRole('button', { name: 'Use my current location' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(code === 2 ? 'couldn’t determine your location' : 'took too long');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  expect(fetch).not.toHaveBeenCalled();
});
