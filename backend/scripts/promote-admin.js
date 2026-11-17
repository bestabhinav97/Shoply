import { query, pool } from '../db/db.js';

try {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run admin:promote --workspace backend -- email@example.com');
  const result = await query("UPDATE users SET role = 'admin', updated_at = now() WHERE email = $1 RETURNING id", [email]);
  if (!result.rowCount) throw new Error('No account found. Sign up first.');
  console.log('Account promoted to admin.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
