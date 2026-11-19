import { pool } from "../../db/db.js";
import { httpError } from "../../shared/errors.js";
import * as repository from "./address.repository.js";

const maxAddresses = 20;

function summarize(rows, preferences) {
  return {
    items: rows.map((row) => ({
      id: row.id,
      recipientName: row.recipient_name,
      phoneNumber: row.phone_number,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      postalCode: row.postal_code,
      city: row.city,
      countryCode: row.country_code,
    })),
    defaultAddressId: preferences?.default_address_id ?? null,
    selectedAddressId: preferences?.selected_address_id ?? null,
  };
}

export async function getAddressBook(userId) {
  const client = await pool.connect();
  try {
    // Both reads see the same snapshot, even if an address is saved between them.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rows = await repository.listAddresses(client, userId);
    const preferences = await repository.getPreferences(client, userId);
    const result = summarize(rows, preferences);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// The controller supplies a session user ID and a validated, normalized address.
export async function addAddress(userId, address) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await repository.lockUser(client, userId);
    if (!user) throw httpError(401, "Please sign in to continue.");

    const existingAddresses = await repository.listAddresses(client, userId);
    if (existingAddresses.length >= maxAddresses) {
      throw httpError(409, `You can save at most ${maxAddresses} addresses.`);
    }
    const existingPreferences = await repository.getPreferences(client, userId);
    const saved = await repository.insertAddress(client, userId, address);
    const preferences = await repository.savePreferences(client, userId, {
      defaultAddressId:
        address.isDefault || !existingPreferences?.default_address_id
          ? saved.id
          : existingPreferences.default_address_id,
      selectedAddressId: address.selectForDelivery
        ? saved.id
        : (existingPreferences?.selected_address_id ?? null),
    });

    const rows = await repository.listAddresses(client, userId);
    const result = summarize(rows, preferences);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function changeAddressPreference(userId, addressId, preference) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await repository.lockUser(client, userId);
    if (!user) throw httpError(401, 'Please sign in to continue.');

    const rows = await repository.listAddresses(client, userId);
    // The same response hides whether an inaccessible address belongs to another user.
    if (!rows.some((address) => address.id === addressId)) {
      throw httpError(404, 'Address not found.');
    }
    const existingPreferences = await repository.getPreferences(client, userId);
    const preferences = await repository.savePreferences(client, userId, {
      defaultAddressId: preference === 'default' ? addressId : existingPreferences?.default_address_id ?? null,
      selectedAddressId: preference === 'selected' ? addressId : existingPreferences?.selected_address_id ?? null,
    });
    const result = summarize(rows, preferences);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function selectDeliveryAddress(userId, addressId) {
  return changeAddressPreference(userId, addressId, 'selected');
}

export function setDefaultAddress(userId, addressId) {
  return changeAddressPreference(userId, addressId, 'default');
}

export async function editAddress(userId, addressId, address) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!await repository.lockUser(client, userId)) throw httpError(401, 'Please sign in to continue.');
    const saved = await repository.updateAddress(client, userId, addressId, address);
    if (!saved) throw httpError(404, 'Address not found.');
    const rows = await repository.listAddresses(client, userId);
    const preferences = await repository.getPreferences(client, userId);
    const result = summarize(rows, preferences);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function removeAddress(userId, addressId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!await repository.lockUser(client, userId)) throw httpError(401, 'Please sign in to continue.');
    // Read preferences before deletion: the foreign keys clear references on delete.
    const previous = await repository.getPreferences(client, userId);
    const removed = await repository.deleteAddress(client, userId, addressId);
    if (!removed) throw httpError(404, 'Address not found.');
    const rows = await repository.listAddresses(client, userId);
    const preferences = await repository.savePreferences(client, userId, {
      defaultAddressId: previous?.default_address_id === addressId
        ? rows[0]?.id ?? null : previous?.default_address_id ?? null,
      selectedAddressId: previous?.selected_address_id === addressId
        ? null : previous?.selected_address_id ?? null,
    });
    const result = summarize(rows, preferences);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
