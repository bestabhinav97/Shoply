import { Router } from 'express';
import { requireAuth } from '../auth/index.js';
import { protectMutation } from '../../shared/csrf.js';
import { createLimiter } from '../../shared/rateLimits.js';
import * as controller from './address.controller.js';

const router = Router();
const addressWriteLimiter = createLimiter(20);
const addressReadLimiter = createLimiter(60);

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', requireAuth, addressReadLimiter, controller.read);
router.post('/', requireAuth, protectMutation, addressWriteLimiter, controller.create);
router.patch('/selected', requireAuth, protectMutation, addressWriteLimiter, controller.select);
router.patch('/default', requireAuth, protectMutation, addressWriteLimiter, controller.setDefault);
router.patch('/:addressId', requireAuth, protectMutation, addressWriteLimiter, controller.update);
router.delete('/:addressId', requireAuth, protectMutation, addressWriteLimiter, controller.remove);

export default router;
