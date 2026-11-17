import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/app/App';

const productId = '20000000-0000-4000-8000-000000000001';
const variantId = '30000000-0000-4000-8000-000000000001';
const itemId = '40000000-0000-4000-8000-000000000001';
const category = { id: 'home', slug: 'home', name: 'Home' };
let signedIn, items, mutations, failure, loadingCart, holdAdd, releaseAdd;
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
function currentCart() {
  return { items: items.map((item) => ({ ...item, lineTotalMinor: item.quantity * item.priceMinor })),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalMinor: items.reduce((sum, item) => sum + item.quantity * item.priceMinor, 0), currency: 'SEK' };
}

beforeEach(() => {
  signedIn = true; items = []; mutations = []; failure = false; loadingCart = false; holdAdd = false;
  window.history.replaceState({}, '', `/products/${productId}`);
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url === '/api/auth/me') return signedIn ? response({ user: { id: 'customer', firstName: 'Shopper', role: 'customer' } }) : response({ message: 'Sign in' }, 401);
    if (url === '/api/auth/csrf') return response({ csrfToken: 'test-csrf' });
    if (url === '/api/categories') return response({ items: [category] });
    if (url.startsWith('/api/products?')) return response({ items: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 0 } });
    if (url === `/api/products/${productId}`) return response({ product: {
      id: productId, name: 'Everyday cup', category, description: 'A simple cup.', images: [], specifications: {},
      options: [{ id: 'color', name: 'Color', values: [{ id: 'white', value: 'White' }, { id: 'blue', value: 'Blue' }] }],
      variants: [{ id: variantId, sku: 'CUP-WHITE', priceMinor: 12500, inStock: true, optionValueIds: ['white'] },
        { id: 'out-of-stock', sku: 'CUP-BLUE', priceMinor: 13500, inStock: false, optionValueIds: ['blue'] }],
    } });
    if (url === '/api/cart') return loadingCart ? response({ message: 'Cart unavailable.' }, 503) : response(currentCart());
    if (url === '/api/cart/items' || url === `/api/cart/items/${itemId}`) {
      const body = JSON.parse(options.body);
      mutations.push({ url, options, body });
      if (holdAdd) await new Promise((resolve) => { releaseAdd = resolve; });
      if (failure) return response({ message: 'Not enough stock.' }, 409);
      if (options.method === 'POST') {
        if (items.length) items[0].quantity += body.quantity;
        else items.push({ id: itemId, productId, variantId, name: 'Everyday cup', options: 'Color: White', sku: 'CUP-WHITE', quantity: body.quantity, priceMinor: 12500, currency: 'SEK', available: true });
      }
      if (options.method === 'PATCH') items[0].quantity = body.quantity;
      if (options.method === 'DELETE') items = [];
      return response(currentCart());
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

test('selected variant and quantity are added once while pending, with confirmation and header count', async () => {
  holdAdd = true;
  const user = userEvent.setup();
  render(<App />);
  const quantity = await screen.findByLabelText('Quantity');
  await user.clear(quantity);
  await user.type(quantity, '2');
  await user.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(await screen.findByRole('button', { name: 'Adding…' })).toBeDisabled();
  expect(quantity).toBeDisabled();
  await waitFor(() => expect(mutations).toHaveLength(1));
  expect(mutations[0].body).toEqual({ variantId, quantity: 2 });
  expect(mutations[0].options.headers['X-CSRF-Token']).toBe('test-csrf');
  await act(async () => releaseAdd());
  expect(await screen.findByText(/Added to your cart/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Added ✓' })).toBeEnabled();
  expect(await screen.findByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
  await user.click(screen.getByRole('link', { name: 'View cart' }));
  expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeVisible();
  expect(await screen.findByText('250,00 kr', { selector: '.cart-summary strong' })).toBeVisible();
});

test('failed additions preserve the selection and quantity, and unavailable variants cannot be submitted', async () => {
  failure = true;
  const user = userEvent.setup();
  render(<App />);
  const quantity = await screen.findByLabelText('Quantity');
  await user.clear(quantity);
  await user.type(quantity, '3');
  await user.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Not enough stock.');
  expect(quantity).toHaveValue(3);
  expect(screen.getByLabelText('Color')).toHaveValue('white');
  await user.selectOptions(screen.getByLabelText('Color'), 'blue');
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(mutations).toHaveLength(1);
});

test('cart quantities can be updated, survive a remount, and items can be removed', async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Add to cart' }));
  await user.click(await screen.findByRole('link', { name: 'View cart' }));
  const cartItems = within(await screen.findByRole('list', { name: 'Cart items' }));
  const quantity = cartItems.getByLabelText('Quantity');
  await user.clear(quantity); await user.type(quantity, '4');
  expect(await screen.findByText('Cart quantity updated.')).toBeVisible();
  expect(await screen.findByRole('link', { name: 'Cart, 4 items' })).toBeVisible();
  view.unmount();
  render(<App />);
  expect(await screen.findByLabelText('Quantity')).toHaveValue(4);
  await user.click(screen.getByRole('button', { name: 'Remove Everyday cup' }));
  expect(await screen.findByText('Your cart is empty.')).toBeVisible();
  expect(await screen.findByRole('link', { name: 'Cart, 0 items' })).toBeVisible();
});

test('guest sign-in returns to the product, and cart is protected', async () => {
  signedIn = false;
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole('link', { name: 'Sign in to add to cart' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/products/${productId}`)}`);
  expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Cart' }));
  expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(window.location.search).toBe('?next=%2Fcart');
});

test('cart loading errors can be retried', async () => {
  window.history.replaceState({}, '', '/cart');
  loadingCart = true;
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Cart unavailable.');
  loadingCart = false;
  await user.click(screen.getByRole('button', { name: 'Retry cart' }));
  expect(await screen.findByText('Your cart is empty.')).toBeVisible();
});


function savedItem(quantity = 1) {
  return { id: itemId, productId, variantId, name: 'Everyday cup', options: 'Color: White', sku: 'CUP-WHITE', quantity, priceMinor: 12500, currency: 'SEK', available: true };
}

test('summary pluralizes counts, auto-updates totals optimistically, and rolls back failed changes', async () => {
  items = [savedItem()];
  window.history.replaceState({}, '', '/cart');
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByText('Subtotal (1 item)')).toBeVisible();
  const summary = within(screen.getByRole('complementary', { name: 'Order summary' }));
  expect(summary.getAllByText('125,00 kr')).toHaveLength(2);
  holdAdd = true;
  failure = true;
  await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
  await waitFor(() => expect(mutations).toHaveLength(1));
  expect(screen.getByText('Subtotal (2 items)')).toBeVisible();
  expect(summary.getAllByText('250,00 kr')).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
  await act(async () => releaseAdd());
  expect(await screen.findByRole('alert')).toHaveTextContent('Not enough stock.');
  expect(screen.getByText('Subtotal (1 item)')).toBeVisible();
  expect(screen.getByLabelText('Quantity')).toHaveValue(1);
  expect(summary.getByText('Calculated at checkout')).toBeVisible();
  await user.click(summary.getByRole('button', { name: /Checkout/ }));
  expect(await screen.findByText(/Checkout isn’t available yet/)).toBeVisible();
});

test('removal has an undo action that restores the selected variant and quantity', async () => {
  items = [savedItem(2)];
  window.history.replaceState({}, '', '/cart');
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Remove Everyday cup' }));
  expect(await screen.findByText('Your cart is empty.')).toBeVisible();
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  expect(await screen.findByText('Item restored to your cart.')).toBeVisible();
  expect(screen.getByLabelText('Quantity')).toHaveValue(2);
  expect(mutations.at(-1).body).toEqual({ variantId, quantity: 2 });
});
