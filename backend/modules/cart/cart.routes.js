import { Router } from 'express';
import { requireAuth } from '../auth/index.js';
import { protectMutation } from '../../shared/csrf.js';
import * as controller from './cart.controller.js';

const router = Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(requireAuth);
router.get('/', controller.read);
router.post('/items', protectMutation, controller.add);
router.patch('/items/:itemId', protectMutation, controller.update);
router.delete('/items/:itemId', protectMutation, controller.remove);
export default router;
