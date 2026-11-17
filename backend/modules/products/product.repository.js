import { query } from "../../db/db.js";

// Sort SQL is selected exclusively from this fixed map, never from request text.
const sorts = {
  newest: "p.created_at DESC, p.id ASC",
  "price-asc": "p.price_minor ASC, p.id ASC",
  "price-desc": "p.price_minor DESC NULLS LAST, p.id ASC",
  name: "p.name ASC, p.id ASC",
};

export async function listProducts(
  { q, category, sort, page, limit, status, availability },
  { includeUnpublished = false } = {},
) {
  // Escape LIKE wildcards so user search text is treated literally.
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const result = await query(
    `
    WITH matching AS (
      SELECT p.id, p.name, p.slug, p.status, p.created_at, c.name AS category_name,
        c.slug AS category_slug, v.price_minor, v.max_price_minor, v.in_stock, v.active_variant_count,
        im.storage_key, im.alt_text, im.width, im.height
      FROM products p JOIN categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT min(pv.price_minor) AS price_minor, max(pv.price_minor) AS max_price_minor,
          bool_or(COALESCE(i.quantity, 0) > 0) AS in_stock,
          count(*)::integer AS active_variant_count
        FROM product_variants pv LEFT JOIN inventory i ON i.variant_id = pv.id
        WHERE pv.product_id = p.id AND pv.active
        HAVING count(*) > 0
      ) v ON true
      LEFT JOIN LATERAL (
        SELECT pi.storage_key, pi.alt_text, pi.width, pi.height
        FROM product_images pi
        WHERE pi.product_id = p.id AND (pi.variant_id IS NULL OR EXISTS (
          SELECT 1 FROM product_variants av WHERE av.id = pi.variant_id AND av.active
        )) ORDER BY pi.position LIMIT 1
      ) im ON true
      WHERE ($5::boolean OR p.status = 'active')
        AND ($5::boolean OR v.price_minor IS NOT NULL)
        AND ($1 = '%%' OR p.name ILIKE $1 OR p.description ILIKE $1
          OR ($5 AND EXISTS (SELECT 1 FROM product_variants sv WHERE sv.product_id=p.id AND sv.sku ILIKE $1)))
        AND ($2::text IS NULL OR c.slug = $2)
        AND ($6::text IS NULL OR p.status = $6)
        AND ($7::text IS NULL OR COALESCE(v.in_stock, false) = ($7 = 'in-stock'))
    ), page_rows AS (
      SELECT p.* FROM matching p
      ORDER BY ${sorts[sort]} LIMIT $3 OFFSET $4
    )
    SELECT (SELECT count(*)::integer FROM matching) AS total,
      COALESCE((SELECT json_agg(page_rows) FROM page_rows), '[]'::json) AS items
  `,
    [
      term,
      category || null,
      limit,
      (page - 1) * limit,
      includeUnpublished,
      status || null,
      availability || null,
    ],
  );
  return result.rows[0];
}

export async function insertCategory(id, { name, slug }) {
  const { rows } = await query(
    "INSERT INTO categories(id,name,slug) VALUES ($1,$2,$3) RETURNING id,name,slug",
    [id, name, slug],
  );
  return rows[0];
}

export async function findProduct(id, admin = false, run = query) {
  const result = await run(
    `
    SELECT p.id, p.slug, p.name, p.description, p.specifications, p.category_id, p.status,
      p.updated_at::text AS version, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.id = $1 AND ($2 OR (p.status = 'active'
      AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active)))
  `,
    [id, admin],
  );
  return result.rows[0] || null;
}

export async function findVariants(productId, admin = false, run = query) {
  const result = await run(
    `
    SELECT v.id, v.sku, v.price_minor, v.active, COALESCE(i.quantity, 0) AS quantity,
      COALESCE(i.quantity, 0) > 0 AS in_stock,
      ARRAY(SELECT s.option_value_id FROM variant_option_values s
        JOIN product_options o ON o.id = s.option_id WHERE s.variant_id = v.id ORDER BY o.position) AS option_value_ids
    FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
    WHERE v.product_id = $1 AND ($2 OR v.active) ORDER BY v.sku, v.id
  `,
    [productId, admin],
  );
  return result.rows;
}

export async function findImages(productId, admin = false, run = query) {
  const result = await run(
    `
    SELECT pi.id, pi.storage_key, pi.alt_text, pi.width, pi.height, pi.variant_id
    FROM product_images pi WHERE pi.product_id = $1 AND ($2 OR pi.variant_id IS NULL OR EXISTS (
      SELECT 1 FROM product_variants v WHERE v.id = pi.variant_id AND v.active
    )) ORDER BY pi.position
  `,
    [productId, admin],
  );
  return result.rows;
}

export async function listCategories(admin = false) {
  const result = await query(
    `
    SELECT c.id, c.name, c.slug FROM categories c WHERE $1 OR EXISTS (
      SELECT 1 FROM products p WHERE p.category_id = c.id AND p.status = 'active'
      AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active)
    ) ORDER BY c.name
  `,
    [admin],
  );
  return result.rows;
}

export async function findOptions(productId, run = query) {
  const { rows } = await run(
    `
    SELECT o.id, o.name, o.position,
      (SELECT json_agg(json_build_object('id', ov.id, 'value', ov.value, 'position', ov.position)
        ORDER BY ov.position) FROM product_option_values ov WHERE ov.option_id = o.id) AS values
    FROM product_options o WHERE o.product_id = $1 ORDER BY o.position`,
    [productId],
  );
  return rows;
}
export async function findCartVariant(client, id) {
  const { rows } = await client.query(`SELECT v.id, i.quantity
    FROM product_variants v JOIN products p ON p.id = v.product_id
    JOIN inventory i ON i.variant_id = v.id
    WHERE v.id = $1 AND v.active AND p.status = 'active'
    FOR SHARE OF p, v, i`, [id]);
  return rows[0];
}
