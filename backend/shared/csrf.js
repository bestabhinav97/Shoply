import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { csrfCookie, cookieOptions } from '../modules/auth/auth.cookies.js';
import { httpError } from './errors.js';

const signature = (value) => createHmac('sha256', env.jwtSecret).update(`csrf:${value}`).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function valid(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) return false;
  const [value, mac] = token.split('.');
  return equal(mac, signature(value));
}

export function issueCsrf(req, res) {
  let token = req.cookies[csrfCookie];
  if (!valid(token)) {
    const value = randomBytes(32).toString('hex');
    token = `${value}.${signature(value)}`;
    res.cookie(csrfCookie, token, { ...cookieOptions, maxAge: env.sessionSeconds * 1000 });
  }
  res.json({ csrfToken: token });
}

export function protectMutation(req, _res, next) {
  const token = req.get('x-csrf-token');
  if (req.get('origin') !== env.appOrigin || !req.is('application/json')
    || !valid(token) || !equal(token, req.cookies[csrfCookie])) {
    return next(httpError(403, 'Request could not be verified. Refresh the page and try again.'));
  }
  next();
}
