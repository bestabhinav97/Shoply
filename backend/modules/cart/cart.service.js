import { pool } from '../../db/db.js';
import { httpError } from '../../shared/errors.js';
import { getCartVariant } from '../products/index.js';
import * as repository from './cart.repository.js';

function summarize(rows) {
  const items = rows.map((row) => ({
    id: row.id, variantId: row.product_variant_id, productId: row.product_id,
    name: row.name, sku: row.sku, options: row.options, quantity: row.quantity,
    priceMinor: row.price_minor, currency: row.currency,
    lineTotalMinor: row.price_minor * row.quantity,
    image: row.storage_key ? { url: `/images/${row.storage_key}`, alt: row.alt_text, width: row.width, height: row.height } : null,
    available: row.active && row.stock >= row.quantity,
  }));
  return { items, currency: 'SEK',
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalMinor: items.reduce((sum, item) => sum + item.lineTotalMinor, 0),
  };
}

export async function getCart(userId) {
  return summarize(await repository.readItems(userId));
}

export async function changeCart(userId, action, { variantId, itemId, quantity }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cartId = await repository.lockCart(client, userId);
    const existing = itemId ? await repository.findItem(client, cartId, itemId) : null;
    if (itemId && !existing) throw httpError(404, 'Cart item not found.');
    if (action === 'remove') {
      await repository.removeItem(client, cartId, itemId);
    } else {
      const rows = await repository.readItems(userId, client.query.bind(client));
      const previous = action === 'add' ? rows.find((item) => item.product_variant_id === variantId) : null;
      const nextQuantity = quantity + (previous?.quantity || 0);
      if (nextQuantity > 99) throw httpError(400, 'A cart item can contain at most 99 units.');
      if (action === 'add' && !previous && rows.length >= 100)
        throw httpError(400, 'Your cart can contain at most 100 different items.');
      const id = existing?.product_variant_id || variantId;
      const variant = await getCartVariant(client, id);
      if (!variant) throw httpError(409, 'This product variant is no longer available.');
      if (variant.quantity < nextQuantity) throw httpError(409, 'There is not enough stock for that quantity.');
      await repository.saveItem(client, cartId, id, nextQuantity);
    }
    const result = summarize(await repository.readItems(userId, client.query.bind(client)));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
