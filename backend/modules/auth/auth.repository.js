import { pool, query } from '../../db/db.js';

export async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

export async function updateProfile(userId, input) {
  const { rows } = await query(`UPDATE users SET
    email = COALESCE($2, email), phone_number = COALESCE($3, phone_number), updated_at = now()
    WHERE id = $1 RETURNING *`, [userId, input.email ?? null, input.phoneNumber ?? null]);
  return rows[0];
}

export async function insertSession(session, database = pool) {
  await database.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [session.id, session.userId, session.expiresAt]);
}

export async function createUserWithSession(user, session) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`INSERT INTO users
      (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [user.id, user.firstName, user.lastName, user.phoneNumber, user.email, user.passwordHash]);
    await insertSession(session, client);
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findSessionUser(sessionId, userId) {
  const { rows } = await query(`SELECT users.id, users.first_name, users.last_name,
    users.phone_number, users.email, users.role FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = $1 AND sessions.user_id = $2 AND sessions.expires_at > now()`, [sessionId, userId]);
  return rows[0];
}

export const deleteSession = (id) => query('DELETE FROM sessions WHERE id = $1', [id]);
export const deleteUserSessions = (userId) => query('DELETE FROM sessions WHERE user_id = $1', [userId]);
