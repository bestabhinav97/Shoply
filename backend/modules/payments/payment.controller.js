import { httpError } from '../../shared/errors.js';
import { generateClientToken, savePaymentMethod, listPaymentMethods, removePaymentMethod } from './payment.service.js';
import { validatePaymentMethod, validateRemoval } from './payment.validation.js';

export async function deletePaymentMethod(req, res) {
  if (Object.keys(req.query).length > 0) throw httpError(400, 'Query parameters are not supported.');
  const { token } = validateRemoval(req.body);
  await removePaymentMethod(req.auth.user.id, token);
  res.status(204).end();
}

export async function readPaymentMethods(req, res) {
  if (Object.keys(req.query).length > 0 || req.body !== undefined) {
    throw httpError(400, 'Send no query parameters or request body.');
  }
  const items = await listPaymentMethods(req.auth.user.id);
  res.json({ items });
}

export async function createPaymentMethod(req, res) {
  if (Object.keys(req.query).length > 0) {
    throw httpError(400, 'Query parameters are not supported.');
  }
  const { nonce } = validatePaymentMethod(req.body);
  const paymentMethod = await savePaymentMethod(req.auth.user.id, nonce);
  res.status(201).json({ paymentMethod });
}

export async function createClientToken(req, res) {
  // Customer/account identifiers and gateway options must never come from the browser.
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
    || Object.keys(req.body).length > 0 || Object.keys(req.query).length > 0) {
    throw httpError(400, 'Send an empty JSON object without query parameters.');
  }
  const clientToken = await generateClientToken();
  res.json({ clientToken });
}
