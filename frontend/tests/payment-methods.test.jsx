import { StrictMode } from 'react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentMethods } from '../src/features/payments';
import { PaymentCardList } from '../src/features/payments/components/PaymentCardList';

const sdk = vi.hoisted(() => ({ createClient: vi.fn(), createFields: vi.fn() }));
vi.mock('braintree-web/client', () => ({ default: { create: sdk.createClient } }));
vi.mock('braintree-web/hosted-fields', () => ({ default: { create: sdk.createFields } }));

let removeStatus, removePending;
let fields, calls, tokenStatus, saveStatus, savePending, savedCard, fieldState, handlers, vaults, apiUserId, listStatus;
beforeEach(() => {
  calls = [];
  tokenStatus = 200;
  saveStatus = 201;
  savePending = null;
  vaults = new Map();
  apiUserId = 'payment-user';
  listStatus = 200;
  removeStatus = 204;
  removePending = null;
  savedCard = { token: 'saved-card-token', brand: 'Visa', last4: '1111', expirationMonth: '12', expirationYear: '2030' };
  fieldState = { fields: { number: { isValid: true }, expirationDate: { isValid: true }, cvv: { isValid: true } }, cards: [] };
  handlers = new Map();
  fields = {
    tokenize: vi.fn().mockResolvedValue({ nonce: 'private-test-nonce' }), teardown: vi.fn().mockResolvedValue(),
    getState: vi.fn(() => fieldState), focus: vi.fn().mockResolvedValue(),
    on: vi.fn((name, callback) => handlers.set(name, callback)), off: vi.fn((name) => handlers.delete(name)),
    setAttribute: vi.fn().mockResolvedValue(), setMessage: vi.fn(),
  };
  sdk.createClient.mockReset().mockResolvedValue({});
  sdk.createFields.mockReset().mockResolvedValue(fields);
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/api/auth/csrf') return new Response(JSON.stringify({ csrfToken: 'test-csrf' }));
    if (url === '/api/payments/client-token') return new Response(JSON.stringify(tokenStatus === 200
      ? { clientToken: 'private-client-token' } : { message: 'Provider secret must not reach the UI' }), { status: tokenStatus });
    if (url === '/api/payments/methods') {
      const userId = apiUserId;
      if (!options.method || options.method === 'GET') return new Response(JSON.stringify(listStatus === 200
        ? { items: vaults.get(userId) || [] } : { message: 'private-provider-detail' }), { status: listStatus });
      if (options.method === 'DELETE') {
        if (removePending) await removePending;
        if (removeStatus === 204) {
          const { token } = JSON.parse(options.body);
          vaults.set(userId, (vaults.get(userId) || []).filter((card) => card.token !== token));
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ message: 'private-removal-error' }), { status: removeStatus });
      }
      if (savePending) await savePending;
      if (saveStatus === 201) vaults.set(userId, [savedCard]);
      return new Response(JSON.stringify(saveStatus === 201 ? { paymentMethod: savedCard } : { message: 'Provider secret must not reach the UI' }), { status: saveStatus });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function mount({ strict = false } = {}) {
  const client = new QueryClient();
  client.setQueryData(['auth', 'user'], { id: 'payment-user', firstName: 'Ada' });
  const page = <QueryClientProvider client={client}><PaymentMethods /></QueryClientProvider>;
  return { ...render(strict ? <StrictMode>{page}</StrictMode> : page), client };
}

async function openCard(user) {
  await user.click(screen.getByRole('button', { name: 'Add a card' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save card' })).toBeEnabled());
}

const saves = () => calls.filter(({ url, options }) => url === '/api/payments/methods' && options.method === 'POST');

test('tokenizes, sends only the nonce with CSRF/cookies, and displays the returned saved card', async () => {
  const user = userEvent.setup();
  const { client } = mount();
  await waitFor(() => expect(calls.some(({ url }) => url === '/api/payments/methods')).toBe(true));
  expect(saves()).toHaveLength(0);
  await openCard(user);
  const tokenRequest = calls.find(({ url }) => url === '/api/payments/client-token');
  expect(tokenRequest.options).toMatchObject({ method: 'POST', credentials: 'include', body: '{}', headers: { 'X-CSRF-Token': 'test-csrf' } });
  expect(sdk.createClient).toHaveBeenCalledWith({ authorization: 'private-client-token' });
  const config = sdk.createFields.mock.calls[0][0];
  expect(config.fields.number.container).toBeInstanceOf(HTMLElement);
  expect(config.fields.cvv.internalLabel).toBe('Security code (CVV)');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  expect(fields.tokenize).toHaveBeenCalledWith({ vault: false });
  expect(await screen.findByText(/Visa ending in 1111 added/)).toBeVisible();
  expect(screen.getByRole('list', { name: 'Saved cards' })).toHaveTextContent('Visa ending in 1111Expires 12/2030');
  expect(saves()[0].options).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify({ nonce: 'private-test-nonce' }), headers: { 'X-CSRF-Token': 'test-csrf' } });
  expect(document.body.textContent).not.toContain('private-test-nonce');
  expect(document.body.textContent).not.toContain('private-client-token');
  await waitFor(() => expect(fields.teardown).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Add a card' })).toHaveFocus();
  expect(JSON.stringify(client.getQueryCache().getAll())).not.toContain('private-test-nonce');
  expect(JSON.stringify(client.getMutationCache().getAll().map((mutation) => mutation.state))).not.toContain('private-test-nonce');
});

test('token failures show safe feedback and can be retried', async () => {
  tokenStatus = 503;
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Add a card' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t open secure card fields');
  expect(document.body.textContent).not.toContain('Provider secret');
  expect(sdk.createFields).not.toHaveBeenCalled();
  tokenStatus = 200;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save card' })).toBeEnabled());
});

test('SDK initialization failure supports retry', async () => {
  sdk.createFields.mockRejectedValueOnce(new Error('private SDK error'));
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Add a card' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t open secure card fields');
  expect(document.body.textContent).not.toContain('private SDK error');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save card' })).toBeEnabled());
});

test('tokenization failures never reach the save endpoint', async () => {
  const user = userEvent.setup();
  mount();
  await openCard(user);
  fields.tokenize.mockRejectedValueOnce({ code: 'HOSTED_FIELDS_FIELDS_INVALID' });
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check the highlighted card details');
  fields.tokenize.mockRejectedValueOnce(new Error('private nonce details'));
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t process the test card');
  expect(saves()).toHaveLength(0);
  expect(document.body.textContent).not.toContain('private nonce details');
});

test('closing while fields are initializing tears down the late instance', async () => {
  let resolveFields;
  sdk.createFields.mockImplementation(() => new Promise((resolve) => { resolveFields = resolve; }));
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Add a card' }));
  await waitFor(() => expect(sdk.createFields).toHaveBeenCalled());
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  resolveFields(fields);
  await waitFor(() => expect(fields.teardown).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(saves()).toHaveLength(0);
});

test('strict mode and reopening create fresh field instances', async () => {
  const user = userEvent.setup();
  mount({ strict: true });
  await openCard(user);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(fields.teardown).toHaveBeenCalledTimes(1));
  await openCard(user);
  expect(sdk.createFields).toHaveBeenCalledTimes(2);
});

test('verification rejection stays in the form and retries with a newly tokenized nonce', async () => {
  saveStatus = 422;
  const user = userEvent.setup();
  mount();
  await openCard(user);
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be verified or saved');
  expect(screen.queryByRole('list', { name: 'Saved cards' })).not.toBeInTheDocument();
  expect(saves()).toHaveLength(1);
  saveStatus = 201;
  fields.tokenize.mockResolvedValueOnce({ nonce: 'fresh-retry-nonce' });
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  await screen.findByText(/Visa ending in 1111 added/);
  expect(JSON.parse(saves()[1].options.body)).toEqual({ nonce: 'fresh-retry-nonce' });
  expect(fields.tokenize).toHaveBeenCalledTimes(2);
});

test('pending saves prevent duplicate submission and dialog dismissal', async () => {
  let resolveSave;
  savePending = new Promise((resolve) => { resolveSave = resolve; });
  const user = userEvent.setup();
  mount();
  await openCard(user);
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
  const event = new Event('cancel', { cancelable: true });
  screen.getByRole('dialog').dispatchEvent(event);
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(fields.tokenize).toHaveBeenCalledTimes(1);
  resolveSave();
  await screen.findByText(/Visa ending in 1111 added/);
});

test('uncertain saves are not retried automatically and do not display a saved card', async () => {
  saveStatus = 503;
  const user = userEvent.setup();
  mount();
  await openCard(user);
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('may have reached Braintree');
  expect(saves()).toHaveLength(1);
  expect(screen.queryByRole('list', { name: 'Saved cards' })).not.toBeInTheDocument();
});

test('an account switch while saving never caches the previous user’s card under the new user', async () => {
  let resolveSave;
  savePending = new Promise((resolve) => { resolveSave = resolve; });
  const user = userEvent.setup();
  const { client } = mount();
  await openCard(user);
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  await waitFor(() => expect(saves()).toHaveLength(1));
  apiUserId = 'other-user';
  client.setQueryData(['auth', 'user'], { id: 'other-user' });
  resolveSave();
  await waitFor(() => expect(client.getMutationCache().getAll().some((mutation) => mutation.state.status === 'pending')).toBe(false));
  expect(client.getQueryData(['payment-methods', 'other-user']) ?? []).toEqual([]);
  expect(client.getQueryData(['payment-methods', 'payment-user']) ?? []).toEqual([]);
});

test('field feedback waits for interaction, updates iframe accessibility and enables saving only when valid', async () => {
  fieldState.fields = { number: { isValid: false }, expirationDate: { isValid: false }, cvv: { isValid: false } };
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Add a card' }));
  await waitFor(() => expect(fields.focus).toHaveBeenCalledWith('number'));
  expect(screen.getByRole('button', { name: 'Save card' })).toBeDisabled();
  expect(screen.queryByText('Enter a valid card number')).not.toBeInTheDocument();
  act(() => handlers.get('blur')({ ...fieldState, emittedBy: 'number' }));
  expect(screen.getByText('Enter a valid card number')).toBeVisible();
  expect(screen.getByRole('group', { name: 'Card number' })).toHaveAttribute('aria-invalid', 'true');
  expect(fields.setAttribute).toHaveBeenCalledWith({ field: 'number', attribute: 'aria-invalid', value: true });
  expect(fields.setMessage).toHaveBeenCalledWith({ field: 'number', message: 'Enter a valid card number' });
  fieldState.fields = { number: { isValid: true }, expirationDate: { isValid: true }, cvv: { isValid: true } };
  act(() => handlers.get('validityChange')({ ...fieldState, emittedBy: 'number' }));
  expect(screen.getByRole('button', { name: 'Save card' })).toBeEnabled();
  expect(screen.queryByText('Enter a valid card number')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(fields.off).toHaveBeenCalledTimes(3);
});

test('card type metadata displays the brand and adjusts four-digit security code guidance', async () => {
  const user = userEvent.setup();
  mount();
  await openCard(user);
  act(() => handlers.get('cardTypeChange')({ cards: [{ niceType: 'American Express', code: { size: 4 } }] }));
  expect(screen.getByLabelText('Detected card: American Express')).toBeVisible();
  expect(screen.getByRole('group', { name: 'Security code (4 digits)' })).toBeVisible();
  expect(fields.setAttribute).toHaveBeenCalledWith({ field: 'cvv', attribute: 'placeholder', value: '1234' });
});

test('card rows show expired dates and loading uses the same row component class', () => {
  const { rerender } = render(<PaymentCardList cards={[{ ...savedCard, expirationYear: '2000' }]} />);
  expect(screen.getByText('Expired 12/2000')).toHaveClass('payment-card-expired');
  rerender(<PaymentCardList cards={[]} loading />);
  expect(screen.getByRole('status', { name: 'Loading saved cards' })).toBeVisible();
  expect(document.querySelectorAll('.payment-card.payment-card-skeleton')).toHaveLength(2);
});

test('saved cards are fetched again after returning to the page and after a fresh query cache', async () => {
  const user = userEvent.setup();
  const first = mount();
  await openCard(user);
  await user.click(screen.getByRole('button', { name: 'Save card' }));
  await screen.findByText(/Visa ending in 1111 added/);
  first.unmount();
  const before = calls.length;
  const second = mount();
  expect(await screen.findByRole('list', { name: 'Saved cards' })).toHaveTextContent('Visa ending in 1111');
  expect(calls.slice(before).some(({ url, options }) => url === '/api/payments/methods' && options.method === 'GET')).toBe(true);
  expect(saves()).toHaveLength(1);
  second.unmount();
  mount();
  expect(await screen.findByRole('list', { name: 'Saved cards' })).toHaveTextContent('Expires 12/2030');
});

test('list failures show a retry action rather than claiming no saved cards', async () => {
  listStatus = 503;
  const user = userEvent.setup();
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load your saved cards');
  expect(screen.queryByText('No saved cards')).not.toBeInTheDocument();
  expect(document.body.textContent).not.toContain('private-provider-detail');
  listStatus = 200;
  vaults.set('payment-user', [savedCard]);
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('list', { name: 'Saved cards' })).toHaveTextContent('Visa ending in 1111');
});


const removals = () => calls.filter(({ options }) => options.method === 'DELETE');

test('removal requires confirmation and sends only the selected token with CSRF', async () => {
  const second = { ...savedCard, token: 'different-token', brand: 'Mastercard', last4: '1111' };
  vaults.set('payment-user', [savedCard, second]);
  const user = userEvent.setup();
  const view = mount();
  await screen.findByRole('list', { name: 'Saved cards' });
  await user.click(screen.getByRole('button', { name: 'Remove Visa ending in 1111' }));
  expect(screen.getByRole('dialog', { name: 'Remove saved card' })).toHaveTextContent('Remove Visa ending in 1111');
  expect(removals()).toHaveLength(0);
  expect(document.body.textContent).not.toContain(savedCard.token);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(removals()).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Remove Visa ending in 1111' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Remove Visa ending in 1111' }));
  await user.click(screen.getByRole('button', { name: 'Remove card', exact: true }));
  expect(await screen.findByText('Visa ending in 1111 removed')).toBeVisible();
  expect(screen.getByRole('list', { name: 'Saved cards' })).toHaveTextContent('Mastercard ending in 1111');
  expect(screen.queryByRole('button', { name: 'Remove Visa ending in 1111' })).not.toBeInTheDocument();
  expect(removals()).toHaveLength(1);
  expect(removals()[0].options).toMatchObject({ method: 'DELETE', credentials: 'include',
    body: JSON.stringify({ token: savedCard.token }), headers: { 'X-CSRF-Token': 'test-csrf' } });
  expect(screen.getByRole('button', { name: 'Add a card' })).toHaveFocus();
  view.unmount();
  mount();
  expect(await screen.findByRole('list', { name: 'Saved cards' })).not.toHaveTextContent('Visa ending');
});

test('failed removals keep the card visible and offer a manual retry', async () => {
  vaults.set('payment-user', [savedCard]);
  removeStatus = 503;
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole('button', { name: 'Remove Visa ending in 1111' }));
  await user.click(screen.getByRole('button', { name: 'Remove card', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm removal');
  expect(screen.getByRole('list', { name: 'Saved cards' })).toHaveTextContent('Visa ending in 1111');
  expect(document.body.textContent).not.toContain('private-removal-error');
  expect(removals()).toHaveLength(1);
  removeStatus = 204;
  await user.click(screen.getByRole('button', { name: 'Remove card', exact: true }));
  expect(await screen.findByText('Visa ending in 1111 removed')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'No saved cards' })).toBeVisible();
  expect(removals()).toHaveLength(2);
});

test('pending removal prevents duplicate clicks and dialog dismissal', async () => {
  let resolveRemoval;
  removePending = new Promise((resolve) => { resolveRemoval = resolve; });
  vaults.set('payment-user', [savedCard]);
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole('button', { name: 'Remove Visa ending in 1111' }));
  await user.dblClick(screen.getByRole('button', { name: 'Remove card', exact: true }));
  await waitFor(() => expect(removals()).toHaveLength(1));
  expect(screen.getByRole('button', { name: 'Removing...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
  act(() => screen.getByRole('dialog').dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(screen.getByRole('dialog')).toBeVisible();
  await act(async () => resolveRemoval());
  expect(await screen.findByText('Visa ending in 1111 removed')).toBeVisible();
});

test('late removal responses cannot affect another account or show a success notice there', async () => {
  let resolveRemoval;
  removePending = new Promise((resolve) => { resolveRemoval = resolve; });
  vaults.set('payment-user', [savedCard]);
  // Even a token collision in a different account cache must be untouched.
  vaults.set('other-user', [{ ...savedCard, brand: 'Mastercard' }]);
  const user = userEvent.setup();
  const { client } = mount();
  await user.click(await screen.findByRole('button', { name: 'Remove Visa ending in 1111' }));
  await user.click(screen.getByRole('button', { name: 'Remove card', exact: true }));
  await waitFor(() => expect(removals()).toHaveLength(1));
  apiUserId = 'other-user';
  act(() => client.setQueryData(['auth', 'user'], { id: 'other-user' }));
  await waitFor(() => expect(screen.getByRole('list', { name: 'Saved cards' })).toHaveTextContent('Mastercard ending in 1111'));
  await act(async () => resolveRemoval());
  await waitFor(() => expect(client.getMutationCache().getAll().some((item) => item.state.status === 'pending')).toBe(false));
  expect(screen.getByRole('list', { name: 'Saved cards' })).toHaveTextContent('Mastercard ending in 1111');
  expect(screen.queryByText('Visa ending in 1111 removed')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
