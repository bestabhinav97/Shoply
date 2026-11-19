import { apiClient } from '../../../lib/apiClient';

export async function createClientToken({ signal }) {
  const result = await apiClient('/payments/client-token', { method: 'POST', body: {}, signal });
  if (typeof result?.clientToken !== 'string' || !result.clientToken.trim()) {
    throw new Error('Card setup is temporarily unavailable. Please try again.');
  }
  return result.clientToken;
}

export async function savePaymentMethod(nonce) {
  const result = await apiClient('/payments/methods', { method: 'POST', body: { nonce } });
  const card = result?.paymentMethod;
  if (!card || typeof card.token !== 'string' || !card.token
    || typeof card.brand !== 'string' || !card.brand
    || typeof card.last4 !== 'string' || !/^\d{4}$/.test(card.last4)
    || typeof card.expirationMonth !== 'string' || !/^(0[1-9]|1[0-2])$/.test(card.expirationMonth)
    || typeof card.expirationYear !== 'string' || !/^\d{4}$/.test(card.expirationYear)) {
    throw new Error('Couldn’t confirm that the card was saved.');
  }
  return {
    token: card.token, brand: card.brand, last4: card.last4,
    expirationMonth: card.expirationMonth, expirationYear: card.expirationYear,
  };
}

export async function fetchPaymentMethods({ signal }) {
  const result = await apiClient('/payments/methods', { signal });
  if (!Array.isArray(result?.items)) throw new Error('Saved cards are temporarily unavailable.');
  return result.items;
}

export async function removePaymentMethod(token) {
  await apiClient('/payments/methods', { method: 'DELETE', body: { token } });
}
