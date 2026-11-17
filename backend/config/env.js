import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

for (const key of ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']) {
  if (!process.env[key]) throw new Error(`Missing ${key}. Configure the root .env file.`);
}

if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
  throw new Error('Set JWT_SECRET in .env to a random secret of at least 32 bytes.');
}

const appOrigin = new URL(process.env.APP_ORIGIN || 'http://localhost:5173').origin;
const production = process.env.NODE_ENV === 'production';
if (production && !appOrigin.startsWith('https://')) {
  throw new Error('APP_ORIGIN must use HTTPS in production.');
}

export const env = {
  production,
  appOrigin,
  jwtSecret: process.env.JWT_SECRET,
  sessionSeconds: 8 * 60 * 60,
  port: Number(process.env.PORT || 3000),
  db: {
    host: '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5433),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  },
};
