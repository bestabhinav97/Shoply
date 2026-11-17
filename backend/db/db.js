import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  ...env.db,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('error', (error) => {
  console.error('Unexpected database pool error:', error.message);
});

export const query = (text, params) => pool.query(text, params);

export async function connectDB() {
  await query('SELECT 1');
  console.log(`Connected to PostgreSQL database: ${env.db.database}`);
}

export default pool;
