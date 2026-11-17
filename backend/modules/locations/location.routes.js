import { Router } from 'express';
import { protectMutation } from '../../shared/csrf.js';
import { createLimiter } from '../../shared/rateLimits.js';
import * as controller from './location.controller.js';

const router = Router();
const locationLimiter = createLimiter(10);

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Guests may look up a city; the existing Origin and CSRF checks still apply.
router.post('/reverse-geocode', protectMutation, locationLimiter, controller.reverseGeocode);

export default router;
