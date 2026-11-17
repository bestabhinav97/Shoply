import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { SignJWT } from 'jose';
import { env } from '../config/env.js';
import { validate } from '../modules/auth/auth.validation.js';

test('Swedish number validation and normalization', () => {
  const data = { firstName: 'Åsa', lastName: 'Öberg', email: ' ASA@example.com ', password: 'a long secure passphrase' };
  for (const phoneNumber of ['070 123 45 67', '+46 70 123 45 67']) {
    const parsed = validate('register', { ...data, phoneNumber });
    assert.equal(parsed.phoneNumber, '+46701234567');
    assert.equal(parsed.email, 'asa@example.com');
  }
  assert.equal(validate('register', { ...data, phoneNumber: '08-123 45 67' }).phoneNumber, '+4681234567');
  for (const phoneNumber of ['+12025550123', '123', 'Call me at 0701234567']) {
    assert.throws(() => validate('register', { ...data, phoneNumber }), { status: 400 });
  }
});

test('authentication against an isolated PostgreSQL schema', async (t) => {
  const schema = `auth_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import('../db/db.js');
  const { migrate } = await import('../db/migrate.js');
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  await migrate();
  await migrate();
  const { default: app } = await import('../app.js');
  const phone = request.agent(app);
  const pc = request.agent(app);
  const signup = { firstName: 'Åsa', lastName: 'Öberg', phoneNumber: '070 123 45 67', email: 'asa@example.com', password: 'a long secure passphrase' };
  async function post(agent, route, body = {}, origin = env.appOrigin) {
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    return agent.post(`/api/auth/${route}`).set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken).send(body);
  }
  let id;
  let phoneCookie;

  await t.test('CSRF, origin, content type and request size', async () => {
    await phone.post('/api/auth/register').send(signup).expect(403);
    assert.equal((await post(phone, 'register', signup, 'https://attacker.example')).status, 403);
    const csrf = await phone.get('/api/auth/csrf');
    await phone.post('/api/auth/register').set('Origin', env.appOrigin).set('X-CSRF-Token', `${csrf.body.csrfToken}f`).send(signup).expect(403);
    await phone.post('/api/auth/register').set('Origin', env.appOrigin).set('X-CSRF-Token', csrf.body.csrfToken).type('form').send(signup).expect(403);
    await phone.post('/api/auth/register').set('Content-Type', 'application/json').send('{').expect(400);
    await phone.post('/api/auth/register').send({ padding: 'x'.repeat(17000) }).expect(413);
  });
  await t.test('validation and attempted admin signup', async () => {
    for (const change of [{ role: 'admin' }, { phoneNumber: '+12025550123' }, { password: 'short' }, { firstName: ' ' }, { email: 'invalid' }]) {
      assert.equal((await post(phone, 'register', { ...signup, ...change })).status, 400);
    }
  });
  await t.test('customer signup, hashing, cookie flags and normalized data', async () => {
    const response = await post(phone, 'register', { ...signup, email: ' ASA@example.com ' });
    assert.equal(response.status, 201);
    id = response.body.user.id;
    assert.equal(response.body.user.role, 'customer');
    assert.equal(response.body.user.phoneNumber, '+46701234567');
    assert.equal(response.body.user.email, 'asa@example.com');
    assert.equal(response.body.user.password_hash, undefined);
    const cookie = response.headers['set-cookie'].find((value) => value.startsWith('shoply_session='));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    phoneCookie = cookie.split(';')[0];
    const stored = (await pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
    assert.match(stored.password_hash, /^\$argon2id\$/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.ok(response.headers['x-content-type-options']);
  });
  await t.test('duplicate emails, unknown users and incorrect passwords', async () => {
    assert.equal((await post(pc, 'register', { ...signup, email: 'ASA@example.com' })).status, 409);
    const wrong = await post(pc, 'login', { email: signup.email, password: 'wrong password' });
    const missing = await post(pc, 'login', { email: 'missing@example.com', password: 'wrong password' });
    assert.equal(wrong.status, 401);
    assert.equal(missing.status, 401);
    assert.equal(wrong.body.message, missing.body.message);
    await request(app).get('/api/auth/me').expect(401);
  });
  await t.test('two devices and authorization using the current database role', async () => {
    assert.equal((await post(pc, 'login', { email: signup.email, password: signup.password })).status, 200);
    await phone.get('/api/auth/me').expect(200);
    await pc.get('/api/auth/me').expect(200);
    assert.equal((await pool.query('SELECT * FROM sessions WHERE user_id = $1', [id])).rowCount, 2);
    const { requireAuth, requireRole } = await import('../modules/auth/auth.middleware.js');
    const adminApp = express();
    adminApp.use(cookieParser());
    adminApp.get('/admin', requireAuth, requireRole('admin'), (_req, res) => res.json({ ok: true }));
    adminApp.use((error, _req, res, _next) => res.status(error.status || 500).end());
    await request(adminApp).get('/admin').set('Cookie', phoneCookie).expect(403);
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [id]);
    await request(adminApp).get('/admin').set('Cookie', phoneCookie).expect(200);
    assert.equal((await pc.get('/api/auth/me')).body.user.role, 'admin');
    await pool.query("UPDATE users SET role = 'customer' WHERE id = $1", [id]);
    await request(adminApp).get('/admin').set('Cookie', phoneCookie).expect(403);
    await assert.rejects(pool.query("UPDATE users SET role = 'owner' WHERE id = $1", [id]), { code: '23514' });
  });
  await t.test('profile updates enforce authentication, CSRF, validation and ownership', async () => {
    async function patch(agent, body) {
      const csrf = await agent.get('/api/auth/csrf').expect(200);
      return agent.patch('/api/auth/me').set('Origin', env.appOrigin).set('X-CSRF-Token', csrf.body.csrfToken).send(body);
    }
    assert.equal((await patch(request.agent(app), { email: 'other@example.com' })).status, 401);
    await phone.patch('/api/auth/me').send({ email: 'other@example.com' }).expect(403);
    for (const input of [{}, { role: 'admin' }, { id, email: 'other@example.com' }, { email: 'bad' }, { phoneNumber: '0701234567' }, { phoneNumber: '+46123' }]) {
      assert.equal((await patch(phone, input)).status, 400);
    }
    const other = await post(request.agent(app), 'register', { ...signup, email: 'other@example.com' });
    assert.equal(other.status, 201);
    assert.equal((await patch(phone, { email: 'OTHER@example.com' })).status, 409);
    const saved = await patch(phone, { email: ' NEW@example.com ', phoneNumber: '+1 202 555 0123' });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.user.email, 'new@example.com');
    assert.equal(saved.body.user.phoneNumber, '+12025550123');
    assert.equal(saved.body.user.password_hash, undefined);
    assert.equal((await pc.get('/api/auth/me')).body.user.email, 'new@example.com');
    assert.equal((await pool.query('SELECT email FROM users WHERE id = $1', [other.body.user.id])).rows[0].email, 'other@example.com');
    await patch(phone, { email: signup.email, phoneNumber: '+46701234567' });
  });
  await t.test('tampered, expired and wrong-audience JWTs', async () => {
    const parts = phoneCookie.split('=')[1].split('.');
    parts[1] = Buffer.from(JSON.stringify({ sub: id, role: 'admin' })).toString('base64url');
    await request(app).get('/api/auth/me').set('Cookie', `shoply_session=${parts.join('.')}`).expect(401);
    for (const variant of [{ expiration: -60, audience: 'shoply-web' }, { expiration: 60, audience: 'other-app' }]) {
      const now = Math.floor(Date.now() / 1000);
      const token = await new SignJWT({ sid: randomUUID() }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(id).setIssuedAt(now - 120).setExpirationTime(now + variant.expiration)
        .setIssuer('shoply-api').setAudience(variant.audience).sign(new TextEncoder().encode(env.jwtSecret));
      await request(app).get('/api/auth/me').set('Cookie', `shoply_session=${token}`).expect(401);
    }
  });
  await t.test('logout affects one device and blocks cookie replay', async () => {
    assert.equal((await post(phone, 'logout')).status, 204);
    await phone.get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', phoneCookie).expect(401);
    await pc.get('/api/auth/me').expect(200);
  });
  await t.test('logout everywhere invalidates all devices', async () => {
    assert.equal((await post(phone, 'login', { email: signup.email, password: signup.password })).status, 200);
    assert.equal((await post(pc, 'logout-all')).status, 204);
    await phone.get('/api/auth/me').expect(401);
    await pc.get('/api/auth/me').expect(401);
    assert.equal((await pool.query('SELECT * FROM sessions WHERE user_id = $1', [id])).rowCount, 0);
  });
  await t.test('database expiry overrides an unexpired JWT', async () => {
    assert.equal((await post(phone, 'login', { email: signup.email, password: signup.password })).status, 200);
    await pool.query("UPDATE sessions SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' WHERE user_id = $1", [id]);
    await phone.get('/api/auth/me').expect(401);
  });
});
