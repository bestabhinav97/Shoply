import { getBraintreeGateway } from "./braintree.client.js";
import { httpError } from "../../shared/errors.js";
import braintree from 'braintree';
import { pool } from '../../db/db.js';
import * as repository from './payment.repository.js';

async function findOrCreateVaultCustomer(customerId) {
  const gateway = getBraintreeGateway();
  try {
    const customer = await gateway.customer.find(customerId);
    if (customer?.id !== customerId) throw new Error('Unexpected customer response.');
    return customer.id;
  } catch (error) {
    // Authentication, network and malformed responses must not trigger creation.
    if (error.type !== braintree.errorTypes.notFoundError) throw error;
  }

  const result = await gateway.customer.create({ id: customerId });
  if (result?.success !== true || result.customer?.id !== customerId) {
    throw new Error('Customer creation failed.');
  }
  return result.customer.id;
}

// Callers must supply the user ID from the authenticated session, never the request body.
export async function getOrCreateBraintreeCustomer(userId) {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Serialize requests for the same user across processes and prevent deletion mid-link.
    const user = await repository.lockUserForCustomerLink(userId, client);
    if (!user) throw httpError(401, 'Please sign in to continue.');

    const existing = await repository.findBraintreeCustomerByUserId(user.id, client);
    if (existing) {
      await client.query('COMMIT');
      return existing.braintree_customer_id;
    }

    // A stable 35-character ID lets retries recover a remote customer after a timeout
    // or database rollback. PostgreSQL and Braintree cannot share a transaction.
    const customerId = await findOrCreateVaultCustomer(`sl_${user.id.replaceAll('-', '')}`);
    await repository.createBraintreeCustomerLink(user.id, customerId, client);
    await client.query('COMMIT');
    return customerId;
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.status === 401) throw error;
    throw httpError(503, 'Customer setup is temporarily unavailable. Please try again later.');
  } finally {
    client?.release();
  }
}

export async function savePaymentMethod(userId, nonce) {
  const customerId = await getOrCreateBraintreeCustomer(userId);
  let result;
  try {
    result = await getBraintreeGateway().paymentMethod.create({
      customerId,
      paymentMethodNonce: nonce,
      options: { verifyCard: true },
    });
  } catch {
    // A timeout may happen after vaulting. Do not retry the single-use nonce here.
    throw httpError(503, 'Couldn’t confirm that the card was saved. Please try again later.');
  }

  if (result?.success === false) {
    throw httpError(422, 'The card could not be saved or verified. Enter the card details again or try another card.');
  }

  try {
    if (result?.success !== true) throw new Error('Unexpected save result.');
    return summarizeCard(result.paymentMethod, customerId);
  } catch {
    throw httpError(503, 'Couldn’t confirm that the card was saved. Please try again later.');
  }
}

function summarizeCard(card, customerId) {
  if (card?.customerId !== customerId
    || typeof card.token !== 'string' || !card.token.trim() || card.token.length > 255
    || typeof card.cardType !== 'string' || !card.cardType.trim() || card.cardType.length > 100
    || typeof card.last4 !== 'string' || !/^\d{4}$/.test(card.last4)
    || typeof card.expirationMonth !== 'string' || !/^(0[1-9]|1[0-2])$/.test(card.expirationMonth)
    || typeof card.expirationYear !== 'string' || !/^\d{4}$/.test(card.expirationYear)) {
    throw new Error('Unexpected card response.');
  }

  // Never return the entire SDK object: it can contain billing and provider data.
  return {
    token: card.token,
    brand: card.cardType,
    last4: card.last4,
    expirationMonth: card.expirationMonth,
    expirationYear: card.expirationYear,
  };
}

export async function listPaymentMethods(userId) {
  try {
    const link = await repository.findBraintreeCustomerByUserId(userId);
    if (!link) return [];
    const customer = await getBraintreeGateway().customer.find(link.braintree_customer_id);
    if (customer?.id !== link.braintree_customer_id || !Array.isArray(customer.creditCards)) {
      throw new Error('Unexpected customer response.');
    }
    return customer.creditCards.map((card) => summarizeCard(card, link.braintree_customer_id));
  } catch {
    throw httpError(503, 'Saved cards are temporarily unavailable. Please try again later.');
  }
}

export async function removePaymentMethod(userId, token) {
  try {
    const link = await repository.findBraintreeCustomerByUserId(userId);
    if (!link) return;
    const gateway = getBraintreeGateway();
    // Only inspect the session owner's cards, never a client-supplied customer ID.
    const customer = await gateway.customer.find(link.braintree_customer_id);
    if (customer?.id !== link.braintree_customer_id || !Array.isArray(customer.creditCards)) {
      throw new Error('Unexpected customer response.');
    }
    const card = customer.creditCards.find((item) => item.token === token);
    // Idempotent retries recover when a deletion succeeded but its response was lost.
    // An absent or foreign token reveals nothing and never reaches provider deletion.
    if (!card) return;
    summarizeCard(card, link.braintree_customer_id);
    try {
      await gateway.paymentMethod.delete(token);
    } catch (error) {
      if (error.type !== braintree.errorTypes.notFoundError) throw error;
    }
  } catch {
    throw httpError(503, 'Could not confirm card removal. Refresh your saved cards before trying again.');
  }
}

export async function generateClientToken() {
  try {
    const result = await getBraintreeGateway().clientToken.generate({});
    if (typeof result?.clientToken !== "string" || !result.clientToken.trim()) {
      throw new Error("No client token returned.");
    }
    return result.clientToken;
  } catch {
    // Provider errors may contain credentials or request details; expose only our message.
    throw httpError(
      503,
      "Card setup is temporarily unavailable. Please try again later.",
    );
  }
}
