import { randomUUID } from 'node:crypto';
import { query } from '../../db/db.js';

export async function readItems(userId, run = query) {
  const { rows } = await run(`
    SELECT ci.id, ci.product_variant_id, ci.quantity, p.id AS product_id,
      p.name, v.sku, v.price_minor, v.currency,
      (p.status = 'active' AND v.active) AS active,
      COALESCE(i.quantity, 0) AS stock,
      im.storage_key, im.alt_text, im.width, im.height,
      COALESCE((SELECT string_agg(o.name || ': ' || ov.value, ', ' ORDER BY o.position)
        FROM variant_option_values vv
        JOIN product_options o ON o.id = vv.option_id
        JOIN product_option_values ov ON ov.id = vv.option_value_id
        WHERE vv.variant_id = v.id), '') AS options
    FROM carts c JOIN cart_items ci ON ci.cart_id = c.id
    JOIN product_variants v ON v.id = ci.product_variant_id
    JOIN products p ON p.id = v.product_id
    LEFT JOIN inventory i ON i.variant_id = v.id
    LEFT JOIN LATERAL (
      SELECT storage_key, alt_text, width, height FROM product_images
      WHERE product_id = p.id AND (variant_id IS NULL OR variant_id = v.id)
      ORDER BY (variant_id IS NOT NULL) DESC, position, id LIMIT 1
    ) im ON true
    WHERE c.user_id = $1 ORDER BY ci.created_at, ci.id`, [userId]);
  return rows;
}

// The upsert takes a row lock so changes to the same customer's cart serialize.
export async function lockCart(client, userId) {
  const { rows } = await client.query(`INSERT INTO carts (id, user_id) VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING id`, [randomUUID(), userId]);
  return rows[0].id;
}

export async function findItem(client, cartId, itemId) {
  return (await client.query('SELECT * FROM cart_items WHERE cart_id = $1 AND id = $2', [cartId, itemId])).rows[0];
}

export async function saveItem(client, cartId, variantId, quantity) {
  await client.query(`INSERT INTO cart_items (id, cart_id, product_variant_id, quantity)
    VALUES ($1, $2, $3, $4) ON CONFLICT (cart_id, product_variant_id)
    DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`, [randomUUID(), cartId, variantId, quantity]);
}

export async function removeItem(client, cartId, itemId) {
  await client.query('DELETE FROM cart_items WHERE cart_id = $1 AND id = $2', [cartId, itemId]);
}
