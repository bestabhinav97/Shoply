import * as repository from "./product.repository.js";
import { httpError } from "../../shared/errors.js";
import { pool } from "../../db/db.js";
import { randomUUID } from "node:crypto";
import { lockProduct, replaceProduct } from "./product.write.repository.js";

function image(row) {
  return row.storage_key
    ? {
        url: `/images/${row.storage_key}`,
        alt: row.alt_text,
        width: row.width,
        height: row.height,
        ...(row.variant_id && { variantId: row.variant_id }),
      }
    : null;
}
const category = (row) => ({
  name: row.category_name,
  slug: row.category_slug,
});

export async function getProducts(filters) {
  const { items, total } = await repository.listProducts(filters);
  return {
    items: items.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: category(row),
      priceMinor: row.price_minor,
      hasPriceRange: row.max_price_minor !== row.price_minor,
      currency: "SEK",
      inStock: row.in_stock,
      image: image(row),
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

export async function getProduct(id, admin = false) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const run = (sql, params) => client.query(sql, params);
    const product = await repository.findProduct(id, admin, run);
    if (!product) throw httpError(404, "Product not found.");
    const variants = await repository.findVariants(id, admin, run);
    const images = await repository.findImages(id, admin, run);
    const options = await repository.findOptions(id, run);
    const result = {
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        specifications: product.specifications,
        options,
        ...(admin && {
          categoryId: product.category_id,
          status: product.status,
          version: product.version,
        }),
        category: category(product),
        images: images.map((row) => ({
          ...image(row),
          ...(admin && {
            id: row.id,
            storageKey: row.storage_key,
            variantId: row.variant_id,
          }),
        })),
        variants: variants.map((row) => ({
          id: row.id,
          sku: row.sku,
          optionValueIds: row.option_value_ids,
          priceMinor: row.price_minor,
          currency: "SEK",
          inStock: row.in_stock,
          active: row.active,
          ...(admin && { quantity: row.quantity }),
        })),
      },
    };
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const getCategories = async () => ({
  items: await repository.listCategories(),
});

export async function getAdminProducts(filters) {
  const { items, total } = await repository.listProducts(filters, {
    includeUnpublished: true,
  });

  return {
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      category: category(row),
      status: row.status,
      priceMinor: row.price_minor,
      hasPriceRange: row.max_price_minor !== row.price_minor,
      currency: "SEK",
      activeVariantCount: row.active_variant_count || 0,
      inStock: Boolean(row.in_stock),
      image: image(row),
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

export const getAdminCategories = async () => ({
  items: await repository.listCategories(true),
});

export async function createCategory(input) {
  try {
    return { category: await repository.insertCategory(randomUUID(), input) };
  } catch (error) {
    if (error.code === "23505")
      throw httpError(409, "A category with this name or slug already exists.");
    throw error;
  }
}

export async function saveProduct(product, existingId) {
  const id = existingId || randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (existingId) {
      const current = await lockProduct(client, id);
      if (!current) throw httpError(404, "Product not found.");
      if (current.version !== product.version)
        throw httpError(
          409,
          "This product changed. Reload before saving your edits.",
        );
    }
    await replaceProduct(client, id, product, !existingId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505")
      throw httpError(
        409,
        "A slug, SKU, option name, value, or variant combination already exists.",
      );
    if (error.code === "23503")
      throw httpError(
        400,
        "Invalid category, option, variant, or image reference.",
      );
    if (error.code === "23514") throw httpError(400, error.message);
    throw error;
  } finally {
    client.release();
  }
  return getProduct(id, true);
}
export async function getCartVariant(client, id) {
  return repository.findCartVariant(client, id);
}
