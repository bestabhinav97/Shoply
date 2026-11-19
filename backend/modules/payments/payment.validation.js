import { z } from 'zod';
import { httpError } from '../../shared/errors.js';

const paymentMethodSchema = z.object({
  nonce: z.string().min(1).max(1024).regex(/^[^\s\p{Cc}\p{Cf}]+$/u),
}).strict();

export function validatePaymentMethod(body) {
  const result = paymentMethodSchema.safeParse(body);
  if (!result.success) {
    // Never include the nonce or provider details in validation feedback.
    throw httpError(400, 'Send only a nonempty nonce string of at most 1024 characters, without whitespace.');
  }
  return result.data;
}

export function validateRemoval(body) {
  const result = z.object({
    token: z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/),
  }).strict().safeParse(body);
  if (!result.success) throw httpError(400, 'Send only a valid payment method token.');
  return result.data;
}
