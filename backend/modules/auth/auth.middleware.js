import { authenticate } from './auth.service.js';
import { sessionCookie, clearSessionCookie } from './auth.cookies.js';
import { httpError } from '../../shared/errors.js';

export async function requireAuth(req, res, next) {
  try {
    req.auth = await authenticate(req.cookies[sessionCookie]);
    next();
  } catch (error) {
    if (error.status === 401) clearSessionCookie(res);
    next(error);
  }
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.auth) return next(httpError(401, 'Please sign in to continue.'));
    if (req.auth.user.role !== role) return next(httpError(403, 'You do not have permission to access this resource.'));
    next();
  };
}
