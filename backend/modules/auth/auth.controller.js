import * as service from './auth.service.js';
import { setSessionCookie, clearSessionCookie, sessionCookie } from './auth.cookies.js';
import { validate } from './auth.validation.js';

export async function register(req, res) {
  const result = await service.register(validate('register', req.body));
  // Replacing the cookie should also retire this browser's previous session.
  await retirePreviousSession(req);
  setSessionCookie(res, result.token);
  res.status(201).json({ user: result.user });
}

export async function login(req, res) {
  const result = await service.login(validate('login', req.body));
  await retirePreviousSession(req);
  setSessionCookie(res, result.token);
  res.json({ user: result.user });
}

async function retirePreviousSession(req) {
  if (!req.cookies[sessionCookie]) return;
  try {
    const previous = await service.authenticate(req.cookies[sessionCookie]);
    await service.logout(previous.sessionId);
  } catch (error) {
    if (error.status !== 401) throw error;
  }
}

export function me(req, res) {
  res.json({ user: req.auth.user });
}

export async function updateProfile(req, res) {
  const input = validate('profile', req.body);
  const user = await service.updateProfile(req.auth.user.id, input);
  res.json({ user });
}

export async function logout(req, res) {
  await service.logout(req.auth.sessionId);
  clearSessionCookie(res);
  res.status(204).end();
}

export async function logoutAll(req, res) {
  await service.logoutAll(req.auth.user.id);
  clearSessionCookie(res);
  res.status(204).end();
}
