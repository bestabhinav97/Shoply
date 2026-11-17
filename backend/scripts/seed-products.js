import { createHash, randomUUID } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { env } from "../config/env.js";
import { pool } from "../db/db.js";
import { categories, products } from "../seeds/products.js";

function seedId(key) {
  const bytes = createHash("sha256")
    .update(`shoply-demo:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Stable IDs protect existing seed products even if an admin changes a slug.
// Existing products and children are untouched, including prices and stock.
export async function seedProducts(database = pool) {
  if (env.production || process.env.NODE_ENV === "production")
    throw new Error("Demo catalog seeding is disabled in production.");
  const photos = JSON.parse(
    await readFile(new URL("../seeds/photos.json", import.meta.url), "utf8"),
  );
  for (const photo of photos) {
    await access(
      new URL(
        `../../frontend/public/images/${photo.storageKey}`,
        import.meta.url,
      ),
    );
  }
  const client = await database.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(8103402)");
    const categoryIds = new Map();
    for (const category of categories) {
      const categoryId = seedId(`category:${category.slug}`);
      await client.query(
        "INSERT INTO categories (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [categoryId, category.name, category.slug],
      );
      const { rows } = await client.query(
        "SELECT id FROM categories WHERE id = $1 OR slug = $2 ORDER BY (id = $1) DESC LIMIT 1",
        [categoryId, category.slug],
      );
      categoryIds.set(category.slug, rows[0].id);
    }
    for (const product of products) {
      const id = seedId(`product:${product.slug}`);
      const firstSku = `DEMO-${product.slug.toUpperCase()}-1`;
      const existing = await client.query(
        `SELECT id FROM products WHERE id = $1 OR slug = $2 OR EXISTS (
          SELECT 1 FROM product_variants v WHERE v.product_id = products.id AND v.sku = $3
        ) LIMIT 1`,
        [id, product.slug, firstSku],
      );

      if (existing.rowCount) continue;

      const result = await client.query(
        `
        INSERT INTO products (id, category_id, slug, name, description, status)
        VALUES ($1, $2, $3, $4, $5, 'active') ON CONFLICT DO NOTHING RETURNING id
      `,
        [
          id,
          categoryIds.get(product.category),
          product.slug,
          product.name,
          product.description,
        ],
      );
      if (!result.rowCount) continue;
      inserted++;
      const optionRows = [];
      for (const [position, option] of (product.options || []).entries()) {
        const optionId = randomUUID();
        await client.query(
          "INSERT INTO product_options(id,product_id,name,position) VALUES ($1,$2,$3,$4)",
          [optionId, id, option.name, position],
        );
        const values = [];
        for (const [valuePosition, value] of option.values.entries()) {
          const valueId = randomUUID();
          await client.query(
            "INSERT INTO product_option_values(id,product_id,option_id,value,position) VALUES ($1,$2,$3,$4,$5)",
            [valueId, id, optionId, value, valuePosition],
          );
          values.push(valueId);
        }
        optionRows.push({ id: optionId, values });
      }
      for (const [index, selections] of (
        product.combinations || [[]]
      ).entries()) {
        const variantId = randomUUID();
        const sku = `DEMO-${product.slug.toUpperCase()}-${index + 1}`;
        await client.query(
          `INSERT INTO product_variants (id, product_id, sku, price_minor) VALUES ($1,$2,$3,$4)`,
          [variantId, id, sku, product.price],
        );
        for (const [optionIndex, valueIndex] of selections.entries()) {
          await client.query(
            "INSERT INTO variant_option_values(product_id,variant_id,option_id,option_value_id) VALUES ($1,$2,$3,$4)",
            [
              id,
              variantId,
              optionRows[optionIndex].id,
              optionRows[optionIndex].values[valueIndex],
            ],
          );
        }
        const quantity = product.quantity ?? (index === 3 ? 0 : 8 + index);
        await client.query(
          "INSERT INTO inventory (variant_id, quantity) VALUES ($1, $2)",
          [variantId, quantity],
        );
      }
      const photo = photos.find((entry) => entry.slug === product.slug);
      if (!photo)
        throw new Error(`Missing photo for seed product: ${product.slug}`);
      await client.query(
        `INSERT INTO product_images (id, product_id, storage_key, alt_text, width, height)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          id,
          photo.storageKey,
          photo.alt,
          photo.width,
          photo.height,
        ],
      );
    }
    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(
      `Demo products added: ${await seedProducts()}. Existing products were left untouched.`,
    );
  } catch (error) {
    console.error("Catalog seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
