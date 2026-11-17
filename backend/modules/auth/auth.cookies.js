import { env } from '../../config/env.js';

export const sessionCookie = env.production ? '__Host-shoply_session' : 'shoply_session';
export const csrfCookie = env.production ? '__Host-shoply_csrf' : 'shoply_csrf';
export const cookieOptions = { httpOnly: true, secure: env.production, sameSite: 'lax', path: '/' };

export function setSessionCookie(res, token) {
  res.cookie(sessionCookie, token, { ...cookieOptions, maxAge: env.sessionSeconds * 1000 });
}

export function clearSessionCookie(res) {
  res.clearCookie(sessionCookie, cookieOptions);
}
