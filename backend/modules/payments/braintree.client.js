import braintree from 'braintree';
import { env } from '../../config/env.js';

let gateway;

export function getBraintreeGateway() {
  if (gateway) return gateway;

  const { merchantId, publicKey, privateKey } = env.braintree;
  if (!merchantId || !publicKey || !privateKey) {
    throw new Error('Configure BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY and BRAINTREE_PRIVATE_KEY in the root .env file.');
  }

  // Create on first use so the rest of the store can run without payment credentials.
  // Construction configures the SDK only; it does not contact Braintree.
  gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId,
    publicKey,
    privateKey,
  });
  gateway.config.timeout = 10_000;

  return gateway;
}
