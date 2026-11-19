import { pool } from '../../db/db.js';

export async function lockUserForCustomerLink(userId, database = pool) {
  const { rows } = await database.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  return rows[0] ?? null;
}

export async function findBraintreeCustomerByUserId(userId, database = pool) {
  const { rows } = await database.query(`SELECT user_id, braintree_customer_id, created_at, updated_at
    FROM braintree_customers WHERE user_id = $1`, [userId]);
  return rows[0] ?? null;
}

export async function createBraintreeCustomerLink(userId, braintreeCustomerId, database = pool) {
  // Insert only: a duplicate must never silently replace a customer's existing link.
  const { rows } = await database.query(`INSERT INTO braintree_customers
    (user_id, braintree_customer_id) VALUES ($1, $2)
    RETURNING user_id, braintree_customer_id, created_at, updated_at`, [userId, braintreeCustomerId]);
  return rows[0];
}
