import { Router } from 'express';
import { requireAuth } from '../auth/index.js';
import { protectMutation } from '../../shared/csrf.js';
import { createLimiter } from '../../shared/rateLimits.js';
import { createClientToken, createPaymentMethod, readPaymentMethods, deletePaymentMethod } from './payment.controller.js';

const router = Router();
const tokenLimiter = createLimiter(20);
const paymentMethodLimiter = createLimiter(20);
const paymentMethodReadLimiter = createLimiter(60);

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/client-token', requireAuth, protectMutation, tokenLimiter, createClientToken);
router.post('/methods', requireAuth, protectMutation, paymentMethodLimiter, createPaymentMethod);
router.get('/methods', requireAuth, paymentMethodReadLimiter, readPaymentMethods);
router.delete('/methods', requireAuth, protectMutation, paymentMethodLimiter, deletePaymentMethod);

export default router;
