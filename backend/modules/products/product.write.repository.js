// All graph writes use the caller's transaction. IDs are stable across edits.
export async function lockProduct(client, id) {
  const { rows } = await client.query(
    "SELECT updated_at::text AS version FROM products WHERE id=$1 FOR UPDATE",
    [id],
  );
  return rows[0] || null;
}

export async function replaceProduct(client, id, product, create) {
  const params = [
    id,
    product.categoryId,
    product.slug,
    product.name,
    product.description,
    product.status,
    JSON.stringify(product.specifications),
  ];
  if (create) {
    await client.query(
      `INSERT INTO products(id, category_id, slug, name, description, status, specifications)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      params,
    );
  } else {
    await client.query(
      `UPDATE products SET category_id=$2, slug=$3, name=$4, description=$5,
      status=$6, specifications=$7, updated_at=clock_timestamp() WHERE id=$1`,
      params,
    );
  }
  // Verify ownership before accepting any existing UUID, even if a child is omitted later.
  const groups = [
    ["product_options", product.options],
    ["product_option_values", product.options.flatMap((o) => o.values)],
    ["product_variants", product.variants],
    ["product_images", product.images],
  ];
  for (const [table, rows] of groups) {
    const conflict = await client.query(
      `SELECT 1 FROM ${table} WHERE id=ANY($1::uuid[]) AND product_id<>$2 LIMIT 1`,
      [rows.map((r) => r.id), id],
    );
    if (conflict.rowCount)
      throw Object.assign(
        new Error("Catalog IDs cannot be reused from another product."),
        { status: 400 },
      );
  }
  // Shared/variant image references are rebuilt explicitly before removing variants.
  await client.query("DELETE FROM product_images WHERE product_id=$1", [id]);
  await client.query("DELETE FROM variant_option_values WHERE product_id=$1", [
    id,
  ]);
  await client.query(
    "DELETE FROM product_variants WHERE product_id=$1 AND NOT (id=ANY($2::uuid[]))",
    [id, product.variants.map((v) => v.id)],
  );
  // Retained value IDs cannot be moved to another option.
  for (const option of product.options) {
    const moved = await client.query(
      "SELECT 1 FROM product_option_values WHERE id=ANY($1::uuid[]) AND option_id<>$2 LIMIT 1",
      [option.values.map((v) => v.id), option.id],
    );
    if (moved.rowCount)
      throw Object.assign(
        new Error(
          "Existing values cannot move between options; create a new value instead.",
        ),
        { status: 400 },
      );
  }
  await client.query(
    "DELETE FROM product_option_values WHERE product_id=$1 AND NOT (id=ANY($2::uuid[]))",
    [id, product.options.flatMap((o) => o.values.map((v) => v.id))],
  );
  await client.query(
    "DELETE FROM product_options WHERE product_id=$1 AND NOT (id=ANY($2::uuid[]))",
    [id, product.options.map((o) => o.id)],
  );
  for (const [position, option] of product.options.entries()) {
    await client.query(
      `INSERT INTO product_options(id,product_id,name,position) VALUES ($1,$2,$3,$4)
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, position=EXCLUDED.position, updated_at=clock_timestamp()`,
      [option.id, id, option.name, position],
    );
    for (const [valuePosition, value] of option.values.entries()) {
      await client.query(
        `INSERT INTO product_option_values(id,product_id,option_id,value,position) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value, position=EXCLUDED.position`,
        [value.id, id, option.id, value.value, valuePosition],
      );
    }
  }
  const valueOptions = new Map(
    product.options.flatMap((o) => o.values.map((v) => [v.id, o.id])),
  );
  for (const variant of product.variants) {
    await client.query(
      `INSERT INTO product_variants(id,product_id,sku,price_minor,active) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET sku=EXCLUDED.sku, price_minor=EXCLUDED.price_minor, active=EXCLUDED.active, updated_at=clock_timestamp()`,
      [variant.id, id, variant.sku, variant.priceMinor, variant.active],
    );
    await client.query(
      `INSERT INTO inventory(variant_id,quantity) VALUES ($1,$2)
      ON CONFLICT (variant_id) DO UPDATE SET quantity=EXCLUDED.quantity, updated_at=clock_timestamp()`,
      [variant.id, variant.quantity],
    );
    for (const valueId of variant.optionValueIds) {
      await client.query(
        "INSERT INTO variant_option_values(product_id,variant_id,option_id,option_value_id) VALUES ($1,$2,$3,$4)",
        [id, variant.id, valueOptions.get(valueId), valueId],
      );
    }
  }
  for (const [position, image] of product.images.entries()) {
    await client.query(
      `INSERT INTO product_images(id,product_id,variant_id,storage_key,alt_text,width,height,position)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        image.id,
        id,
        image.variantId,
        image.storageKey,
        image.alt,
        image.width,
        image.height,
        position,
      ],
    );
  }
}
