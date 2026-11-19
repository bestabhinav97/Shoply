import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { sendEmail } from '../shared/email.js';

test('email helper validates configuration, uses TLS and sanitizes failures', async (t) => {
  const original = env.smtp;
  t.after(() => { env.smtp = original; });
  const message = { to: 'recipient@example.com', subject: 'Test', text: 'Test message' };
  const sendMail = t.mock.fn(async () => ({ accepted: [message.to], rejected: [] }));
  const createTransport = t.mock.method(nodemailer, 'createTransport', () => ({ sendMail }));

  env.smtp = { host: '', port: 587, user: '', password: '', from: '' };
  await assert.rejects(sendEmail(message), { status: 503, message: 'Email delivery is not configured.' });
  assert.equal(createTransport.mock.callCount(), 0);

  env.smtp = { host: 'smtp.example.com', port: 587, user: 'test-user', password: 'test-only-secret', from: 'sender@example.com' };
  await sendEmail(message);
  const options = createTransport.mock.calls[0].arguments[0];
  assert.equal(options.secure, false);
  assert.equal(options.requireTLS, true);
  assert.deepEqual(options.auth, { user: env.smtp.user, pass: env.smtp.password });
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
  assert.deepEqual(sendMail.mock.calls[0].arguments[0], { ...message, from: env.smtp.from, html: undefined });

  sendMail.mock.mockImplementation(async () => { throw new Error('Private SMTP details'); });
  await assert.rejects(sendEmail(message), { status: 503, message: 'Email could not be sent. Please try again later.' });
  sendMail.mock.mockImplementation(async () => ({ accepted: [], rejected: [message.to] }));
  await assert.rejects(sendEmail(message), { status: 503, message: 'Email could not be sent. Please try again later.' });
  assert.equal(createTransport.mock.callCount(), 1);
});
