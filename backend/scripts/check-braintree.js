try {
  // Load inside the try block so configuration failures also get safe output.
  const { env } = await import('../config/env.js');
  if (!env.braintree.merchantId || !env.braintree.publicKey || !env.braintree.privateKey) {
    console.error('Braintree sandbox check requires BRAINTREE_MERCHANT_ID, BRAINTREE_PUBLIC_KEY and BRAINTREE_PRIVATE_KEY in the root .env file.');
    process.exitCode = 1;
  } else {
    const { getBraintreeGateway } = await import('../modules/payments/braintree.client.js');
    const result = await getBraintreeGateway().clientToken.generate({});
    if (typeof result.clientToken !== 'string' || !result.clientToken.trim()) {
      throw new Error('No client token returned.');
    }
    // The token is only used to confirm connectivity; never log or persist it.
    console.log('Braintree sandbox connection successful.');
  }
} catch {
  // SDK errors can include request details. Do not print raw errors or responses.
  console.error('Braintree sandbox connection check failed. Check the root .env configuration, sandbox credentials and network connection.');
  process.exitCode = 1;
}
