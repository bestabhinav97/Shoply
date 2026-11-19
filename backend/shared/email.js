import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { httpError } from './errors.js';

let transporter;

function getTransporter() {
  const { host, port, user, password, from } = env.smtp;
  // Validate on first use so other store features work without email setup.
  if (!host || !user || !password || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw httpError(503, 'Email delivery is not configured.');
  }

  transporter ??= nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transporter;
}

export async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransporter();
  try {
    const result = await mailer.sendMail({ from: env.smtp.from, to, subject, text, html });
    if (!result.accepted?.length || result.rejected?.length) {
      throw new Error('Recipient rejected.');
    }
  } catch {
    // SMTP errors can contain addresses, credentials or message content.
    throw httpError(503, 'Email could not be sent. Please try again later.');
  }
}
