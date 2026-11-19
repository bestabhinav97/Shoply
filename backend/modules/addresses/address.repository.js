import { randomUUID } from 'node:crypto';

// The service must begin a transaction and reuse this client for all address writes.
export async function lockUser(client, userId) {
  const { rows } = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  return rows[0];
}

export async function insertAddress(client, userId, address) {
  const { rows } = await client.query(`INSERT INTO addresses
    (id, user_id, recipient_name, phone_number, address_line1, address_line2, postal_code, city, country_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`, [
    randomUUID(), userId, address.recipientName, address.phoneNumber,
    address.addressLine1, address.addressLine2, address.postalCode, address.city, address.countryCode,
  ]);
  return rows[0];
}

export async function getPreferences(client, userId) {
  const { rows } = await client.query(
    'SELECT * FROM user_address_preferences WHERE user_id = $1', [userId],
  );
  return rows[0];
}

export async function listAddresses(client, userId) {
  const { rows } = await client.query(`SELECT * FROM addresses
    WHERE user_id = $1 ORDER BY created_at, id`, [userId]);
  return rows;
}

// Save the complete preference state. The service decides which existing IDs to preserve.
export async function savePreferences(client, userId, { defaultAddressId, selectedAddressId }) {
  const { rows } = await client.query(`INSERT INTO user_address_preferences
    (user_id, default_address_id, selected_address_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET
      default_address_id = EXCLUDED.default_address_id,
      selected_address_id = EXCLUDED.selected_address_id,
      updated_at = now()
    RETURNING *`, [userId, defaultAddressId, selectedAddressId]);
  return rows[0];
}

export async function updateAddress(client, userId, addressId, address) {
  const { rows } = await client.query(`UPDATE addresses SET
    recipient_name = $3, phone_number = $4, address_line1 = $5, address_line2 = $6,
    postal_code = $7, city = $8, country_code = $9, updated_at = now()
    WHERE user_id = $1 AND id = $2 RETURNING *`, [
    userId, addressId, address.recipientName, address.phoneNumber, address.addressLine1,
    address.addressLine2, address.postalCode, address.city, address.countryCode,
  ]);
  return rows[0];
}

export async function deleteAddress(client, userId, addressId) {
  const { rows } = await client.query(
    'DELETE FROM addresses WHERE user_id = $1 AND id = $2 RETURNING id', [userId, addressId],
  );
  return rows[0];
}
