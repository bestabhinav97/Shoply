import { randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify, errors } from 'jose';
import { env } from '../../config/env.js';
import { httpError } from '../../shared/errors.js';
import * as repository from './auth.repository.js';

const key = new TextEncoder().encode(env.jwtSecret);
const issuer = 'shoply-api';
const audience = 'shoply-web';
const hashOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
// Use a real hash even when an email is unknown, reducing login timing differences.
const dummyHash = await argon2.hash(randomBytes(32), hashOptions);

export function publicUser(user) {
  return {
    id: user.id, firstName: user.first_name, lastName: user.last_name,
    phoneNumber: user.phone_number, email: user.email, role: user.role,
  };
}

async function newSession(userId) {
  const now = Math.floor(Date.now() / 1000);
  const session = { id: randomUUID(), userId, expiresAt: new Date((now + env.sessionSeconds) * 1000) };
  const token = await new SignJWT({ sid: session.id }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId).setIssuer(issuer).setAudience(audience).setIssuedAt(now)
    .setExpirationTime(now + env.sessionSeconds).sign(key);
  return { session, token };
}

export async function register(input) {
  const id = randomUUID();
  const passwordHash = await argon2.hash(input.password, hashOptions);
  const { session, token } = await newSession(id);
  try {
    const user = await repository.createUserWithSession({ ...input, id, passwordHash }, session);
    return { user: publicUser(user), token };
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'An account with this email already exists. Try signing in.');
    throw error;
  }
}

export async function login(input) {
  const user = await repository.findByEmail(input.email);
  const valid = await argon2.verify(user?.password_hash || dummyHash, input.password);
  if (!user || !valid) throw httpError(401, 'Email or password is incorrect.');
  const { session, token } = await newSession(user.id);
  await repository.insertSession(session);
  return { user: publicUser(user), token };
}

export async function authenticate(token) {
  if (!token) throw httpError(401, 'Please sign in to continue.');
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'], issuer, audience, typ: 'JWT',
      requiredClaims: ['sub', 'sid', 'iat', 'exp'], maxTokenAge: `${env.sessionSeconds}s`,
    }));
  } catch (error) {
    if (error instanceof errors.JOSEError) throw httpError(401, 'Your session has expired. Please sign in again.');
    throw error;
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof payload.sid !== 'string' || !uuid.test(payload.sid) || !uuid.test(payload.sub)) {
    throw httpError(401, 'Invalid session.');
  }
  const user = await repository.findSessionUser(payload.sid, payload.sub);
  if (!user) throw httpError(401, 'Your session has expired. Please sign in again.');
  return { user: publicUser(user), sessionId: payload.sid };
}

export const logout = repository.deleteSession;

export async function updateProfile(userId, input) {
  try {
    // TODO: Verify ownership of changed email addresses and phone numbers.
    const user = await repository.updateProfile(userId, input);
    if (!user) throw httpError(401, 'Please sign in to continue.');
    return publicUser(user);
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'This email is already in use.', { email: 'This email is already in use.' });
    throw error;
  }
}
export const logoutAll = repository.deleteUserSessions;
