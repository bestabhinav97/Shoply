import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import request from "supertest";
import { env } from "../config/env.js";
import { validateProduct } from "../modules/products/product.validation.js";

function fixture(categoryId, names = ["RAM", "Storage"]) {
  const options = names.map((name) => ({
    id: randomUUID(),
    name,
    values: ["First", "Second"].map((value) => ({ id: randomUUID(), value })),
  }));
  return {
    categoryId,
    name: "Dynamic product",
    slug: `dynamic-${randomBytes(6).toString("hex")}`,
    description: "A configurable product",
    status: "active",
    specifications: { screen: "15.6 inches" },
    options,
    variants: [0, ...(options.length ? [1] : [])].map((i) => ({
      id: randomUUID(),
      sku: `${i}-${randomUUID()}`,
      priceMinor: i ? 59900 : 49900,
      quantity: i ? 3 : 0,
      currency: "SEK",
      active: true,
      optionValueIds: options.map((o) => o.values[i].id),
    })),
    images: [],
  };
}
const writeBody = (p) => ({
  ...Object.fromEntries(
    [
      "version",
      "categoryId",
      "name",
      "slug",
      "description",
      "status",
      "specifications",
    ].map((key) => [key, p[key]]),
  ),
  options: p.options.map((o) => ({
    id: o.id,
    name: o.name,
    values: o.values.map((v) => ({ id: v.id, value: v.value })),
  })),
  variants: p.variants.map((v) =>
    Object.fromEntries(
      [
        "id",
        "sku",
        "priceMinor",
        "currency",
        "quantity",
        "active",
        "optionValueIds",
      ].map((key) => [key, v[key]]),
    ),
  ),
  images: p.images.map((i) =>
    Object.fromEntries(
      ["id", "variantId", "storageKey", "alt", "width", "height"].map((key) => [
        key,
        i[key],
      ]),
    ),
  ),
});

test("automatic SKUs accept missing or blank codes and preserve custom codes", () => {
  const p = fixture(randomUUID());
  delete p.variants[0].sku;
  p.variants[1].sku = "   ";
  const parsed = validateProduct(p);
  assert.notEqual(parsed.variants[0].sku, parsed.variants[1].sku);
  assert.match(parsed.variants[0].sku, /^SL-[A-F0-9]{32}$/);
  assert.deepEqual(validateProduct(p), parsed);
  p.variants[0].sku = " MY-CUSTOM-SKU ";
  assert.equal(validateProduct(p).variants[0].sku, "MY-CUSTOM-SKU");
  p.variants[1].sku = parsed.variants[1].sku;
  p.variants[0].sku = parsed.variants[1].sku;
  assert.throws(() => validateProduct(p), { status: 400 });
  p.variants[0].sku = "x".repeat(101);
  assert.throws(() => validateProduct(p), { status: 400 });
});

test("dynamic configuration validation", () => {
  for (const names of [
    [],
    ["Material"],
    ["Color", "Size"],
    ["RAM", "Storage"],
    ["Size", "Color", "Fit"],
  ]) {
    assert.equal(
      validateProduct(fixture(randomUUID(), names)).options.length,
      names.length,
    );
  }
  const invalid = (change) => {
    const p = fixture(randomUUID());
    change(p);
    assert.throws(() => validateProduct(p), { status: 400 });
  };
  invalid((p) => {
    p.specifications = [];
  });
  invalid((p) => {
    p.specifications = null;
  });
  invalid((p) => {
    p.options[1].name = " ram ";
  });
  invalid((p) => {
    p.options[0].values[1].value = " first ";
  });
  invalid((p) => {
    p.options[0].name = " ";
  });
  invalid((p) => {
    p.variants[0].optionValueIds.pop();
  });
  invalid((p) => {
    p.variants[0].optionValueIds = p.options[0].values.map((v) => v.id);
  });
  invalid((p) => {
    p.variants[0].optionValueIds[0] = randomUUID();
  });
  invalid((p) => {
    p.variants[1].optionValueIds = [...p.variants[0].optionValueIds].reverse();
  });
  invalid((p) => {
    p.variants[0].priceMinor = -1;
  });
  invalid((p) => {
    p.variants[0].quantity = -1;
  });
  invalid((p) => {
    p.variants[1].sku = p.variants[0].sku;
  });
  invalid((p) => {
    p.variants = Array.from({ length: 251 }, () => p.variants[0]);
  });
  const simple = fixture(randomUUID(), []);
  simple.variants.push({
    ...simple.variants[0],
    id: randomUUID(),
    sku: randomUUID(),
  });
  assert.throws(() => validateProduct(simple), /combinations must be unique/);
});

test("legacy migration and dynamic admin/public APIs in an isolated schema", async (t) => {
  const schema = `dynamic_test_${randomBytes(8).toString("hex")}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;
  const { pool } = await import("../db/db.js");
  const { migrate } = await import("../db/migrate.js");
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });
  for (const name of ["001_auth.sql", "002_catalog.sql"]) {
    await pool.query(
      await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
    );
  }
  await pool.query(
    "CREATE TABLE schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await pool.query(
    "INSERT INTO schema_migrations(name) VALUES ('001_auth.sql'),('002_catalog.sql')",
  );
  const categoryId = randomUUID(),
    legacyId = randomUUID(),
    legacyVariantId = randomUUID(),
    secondId = randomUUID();
  await pool.query(
    "INSERT INTO categories(id,name,slug) VALUES ($1,'All products','all')",
    [categoryId],
  );
  await pool.query(
    "INSERT INTO products(id,category_id,slug,name,description,status) VALUES ($1,$2,'legacy','Legacy','','active')",
    [legacyId, categoryId],
  );
  await pool.query(
    "INSERT INTO product_variants(id,product_id,sku,color,size,price_minor,active) VALUES ($1,$2,'LEGACY','White','EU 42',44900,false)",
    [legacyVariantId, legacyId],
  );
  await pool.query("INSERT INTO inventory(variant_id,quantity) VALUES ($1,7)", [
    legacyVariantId,
  ]);
  const imageId = randomUUID();
  await pool.query(
    "INSERT INTO product_images(id,product_id,variant_id,storage_key,alt_text,width,height) VALUES ($1,$2,$3,'products/legacy.webp','Legacy',800,1000)",
    [imageId, legacyId, legacyVariantId],
  );

  await t.test(
    "ambiguous legacy data aborts atomically before dropping columns",
    async () => {
      await pool.query(
        "INSERT INTO product_variants(id,product_id,sku,color,size,price_minor) VALUES ($1,$2,'INCOMPLETE',NULL,'EU 43',44900)",
        [secondId, legacyId],
      );
      await assert.rejects(migrate(), /mixed NULL/);
      assert.equal(
        (
          await pool.query("SELECT color FROM product_variants WHERE id=$1", [
            legacyVariantId,
          ])
        ).rows[0].color,
        "White",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name='product_options'",
            [schema],
          )
        ).rowCount,
        0,
      );
      await pool.query(
        "UPDATE product_variants SET color=' white ',size='EU 42' WHERE id=$1",
        [secondId],
      );
      await assert.rejects(migrate(), /collide/);
      await pool.query("DELETE FROM product_variants WHERE id=$1", [secondId]);
    },
  );
  await pool.query(
    "INSERT INTO product_variants(id,product_id,sku,color,size,price_minor,active) VALUES ($1,$2,'LEGACY-SECOND','White','EU 43',45900,false)",
    [secondId, legacyId],
  );
  const oldSimpleId = randomUUID(),
    oldSingleId = randomUUID();
  for (const [id, name, color] of [
    [oldSimpleId, "old-simple", null],
    [oldSingleId, "old-single", "Blue"],
  ]) {
    await pool.query(
      "INSERT INTO products(id,category_id,slug,name,description,status) VALUES ($1,$2,$3,$3,'','active')",
      [id, categoryId, name],
    );
    await pool.query(
      "INSERT INTO product_variants(id,product_id,sku,color,size,price_minor) VALUES ($1,$2,$3,$4,NULL,100)",
      [randomUUID(), id, name, color],
    );
  }
  const duplicateCategory = randomUUID();
  await pool.query(
    "INSERT INTO categories(id,name,slug) VALUES ($1,' all products ','duplicate-all')",
    [duplicateCategory],
  );
  await assert.rejects(migrate(), /Category migration/);
  await pool.query("DELETE FROM categories WHERE id=$1", [duplicateCategory]);
  await migrate();
  await migrate();
  const { default: app } = await import("../app.js");
  const agent = request.agent(app);
  const csrf = (await agent.get("/api/auth/csrf").expect(200)).body.csrfToken;
  const mutate = (method, path, body) =>
    agent[method](path)
      .set("Origin", env.appOrigin)
      .set("X-CSRF-Token", csrf)
      .send(body);
  await mutate("post", "/api/auth/register", {
    firstName: "Admin",
    lastName: "Tester",
    email: "dynamic@example.com",
    phoneNumber: "0701234567",
    password: "a long test passphrase",
  }).expect(201);
  await pool.query(
    "UPDATE users SET role='admin' WHERE email='dynamic@example.com'",
  );

  await t.test(
    "migration preserves UUIDs, inactive state, price, inventory and variant images",
    async () => {
      const p = (await agent.get(`/api/admin/products/${legacyId}`).expect(200))
        .body.product;
      assert.deepEqual(
        p.options.map((o) => o.name),
        ["Color", "Size"],
      );
      assert.equal(p.variants[0].id, legacyVariantId);
      assert.equal(p.variants[0].sku, "LEGACY");
      assert.equal(p.variants[0].priceMinor, 44900);
      assert.equal(p.variants[0].quantity, 7);
      assert.equal(p.variants[0].active, false);
      assert.equal(p.images[0].id, imageId);
      assert.equal(p.images[0].variantId, legacyVariantId);
      assert.equal(p.variants.length, 2);
      const oldSimple = (await agent.get(`/api/admin/products/${oldSimpleId}`))
        .body.product;
      const oldSingle = (await agent.get(`/api/admin/products/${oldSingleId}`))
        .body.product;
      assert.equal(oldSimple.options.length, 0);
      assert.equal(oldSimple.variants.length, 1);
      assert.deepEqual(oldSimple.variants[0].optionValueIds, []);
      assert.deepEqual(
        oldSingle.options.map((o) => o.name),
        ["Color"],
      );
      assert.equal(oldSingle.options[0].values[0].value, "Blue");
      assert.equal(
        (
          await pool.query(
            "SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name='product_variants' AND column_name IN ('color','size')",
            [schema],
          )
        ).rowCount,
        0,
      );
      await request(app).get(`/api/products/${legacyId}`).expect(404);
    },
  );

  await t.test(
    "admins create reusable categories with normalized uniqueness and mutation protection",
    async () => {
      await request(app)
        .post("/api/admin/products/categories")
        .send({ name: "Laptops", slug: "laptops" })
        .expect(401);
      await agent
        .post("/api/admin/products/categories")
        .send({ name: "Laptops", slug: "laptops" })
        .expect(403);
      const result = await mutate("post", "/api/admin/products/categories", {
        name: " Laptops ",
        slug: "laptops",
      }).expect(201);
      const c = result.body.category;
      assert.equal(c.name, "Laptops");
      assert.ok(
        (await agent.get("/api/admin/products/categories")).body.items.some(
          (row) => row.id === c.id,
        ),
      );
      assert.ok(
        !(await request(app).get("/api/categories")).body.items.some(
          (row) => row.id === c.id,
        ),
      );
      await mutate("post", "/api/admin/products/categories", {
        name: "laptops",
        slug: "another-laptop",
      }).expect(409);
      await mutate("post", "/api/admin/products/categories", {
        name: "Notebook",
        slug: "laptops",
      }).expect(409);
      await mutate("post", "/api/admin/products/categories", {
        name: " ",
        slug: "invalid",
      }).expect(400);
      await mutate("post", "/api/admin/products/categories", {
        name: "Invalid",
        slug: "../private",
      }).expect(400);
      const body = fixture(c.id, []);
      await mutate("post", "/api/admin/products", body).expect(201);
      assert.ok(
        (await request(app).get("/api/categories")).body.items.some(
          (row) => row.id === c.id,
        ),
      );
    },
  );

  await t.test(
    "admin filters compose across status, category, stock, SKU, sorting and pagination",
    async () => {
      const rows = [];
      for (const [i, status] of ["draft", "active", "archived"].entries()) {
        const body = fixture(categoryId, []);
        body.name = "Filter showcase";
        body.status = status;
        body.variants[0].quantity = i === 1 ? 0 : 3;
        body.variants[0].priceMinor = (i + 1) * 1000;
        rows.push(
          (await mutate("post", "/api/admin/products", body).expect(201)).body
            .product,
        );
      }
      const get = (query) =>
        agent
          .get("/api/admin/products")
          .query({ q: "Filter showcase", ...query })
          .expect(200);
      assert.equal(
        (
          await get({
            status: "draft",
            category: "all",
            availability: "in-stock",
          })
        ).body.items[0].id,
        rows[0].id,
      );
      assert.equal(
        (await get({ availability: "out-of-stock" })).body.pagination.total,
        1,
      );
      assert.equal(
        (await get({ availability: "in-stock" })).body.pagination.total,
        2,
      );
      const page = (await get({ sort: "price-desc", limit: "1", page: "2" }))
        .body;
      assert.equal(page.pagination.total, 3);
      assert.equal(page.items[0].id, rows[1].id);
      assert.equal(
        (
          await agent
            .get("/api/admin/products")
            .query({ q: rows[2].variants[0].sku })
            .expect(200)
        ).body.items[0].id,
        rows[2].id,
      );
      for (const query of [{ status: "hidden" }, { availability: "yes" }])
        await agent.get("/api/admin/products").query(query).expect(400);
      await request(app).get("/api/products?status=draft").expect(400);
      await request(app).get("/api/products?availability=in-stock").expect(400);
      await pool.query(
        "UPDATE users SET role='customer' WHERE email='dynamic@example.com'",
      );
      await mutate("post", "/api/admin/products/categories", {
        name: "Forbidden",
        slug: "forbidden",
      }).expect(403);
      await pool.query(
        "UPDATE users SET role='admin' WHERE email='dynamic@example.com'",
      );
    },
  );

  await t.test(
    "automatic SKUs persist for multiple variants and survive edits",
    async () => {
      const body = fixture(categoryId);
      delete body.variants[0].sku;
      body.variants[1].sku = " ";
      const created = (
        await mutate("post", "/api/admin/products", body).expect(201)
      ).body.product;
      const codes = created.variants.map((v) => v.sku).sort();
      assert.equal(new Set(codes).size, 2);
      for (const v of created.variants) {
        assert.equal(v.sku, `SL-${v.id.replaceAll("-", "").toUpperCase()}`);
      }
      const replacement = writeBody(created);
      replacement.name = "Renamed product";
      const updated = (
        await mutate(
          "put",
          `/api/admin/products/${created.id}`,
          replacement,
        ).expect(200)
      ).body.product;
      assert.deepEqual(updated.variants.map((v) => v.sku).sort(), codes);
      const stored = (
        await agent.get(`/api/admin/products/${created.id}`).expect(200)
      ).body.product;
      assert.deepEqual(stored.variants.map((v) => v.sku).sort(), codes);
    },
  );

  let laptop, simple, single, triple;
  await t.test(
    "creates complete graphs for two, zero, one and three options",
    async () => {
      const created = [];
      for (const names of [
        ["RAM", "Storage"],
        [],
        ["Material"],
        ["Size", "Color", "Fit"],
      ]) {
        const body = fixture(categoryId, names);
        body.images = [
          {
            id: randomUUID(),
            variantId: body.variants[0].id,
            storageKey: "products/dynamic.webp",
            alt: "Dynamic photo",
            width: 800,
            height: 1000,
          },
        ];
        const response = await mutate(
          "post",
          "/api/admin/products",
          body,
        ).expect(201);
        const p = response.body.product;
        created.push(p);
        assert.equal(p.options.length, names.length);
        assert.deepEqual(
          p.variants.map((v) => v.id).sort(),
          body.variants.map((v) => v.id).sort(),
        );
        assert.equal(p.images[0].variantId, body.variants[0].id);
        assert.deepEqual(p.specifications, { screen: "15.6 inches" });
      }
      [laptop, simple, single, triple] = created;
      assert.equal(simple.variants.length, 1);
      assert.equal(single.options.length, 1);
      assert.equal(triple.options.length, 3);
    },
  );

  await t.test(
    "public list prices include out-of-stock active variants and quantities stay private",
    async () => {
      const listing = (
        await request(app).get(`/api/products?q=${laptop.name}`).expect(200)
      ).body;
      const item = listing.items.find((p) => p.id === laptop.id);
      assert.equal(item.priceMinor, 49900);
      assert.equal(item.hasPriceRange, true);
      assert.equal(item.inStock, true);
      const p = (
        await request(app).get(`/api/products/${laptop.id}`).expect(200)
      ).body.product;
      assert.equal(p.variants[0].quantity, undefined);
      assert.equal(p.status, undefined);
      assert.equal(p.version, undefined);
      assert.equal(p.images[0].variantId, laptop.images[0].variantId);
    },
  );

  await t.test(
    "invalid definitions are rejected, references cannot cross products, and writes roll back",
    async () => {
      const before = (
        await pool.query("SELECT count(*)::int AS n FROM products")
      ).rows[0].n;
      const invalid = fixture(categoryId);
      invalid.variants[0].optionValueIds[0] = simple.variants[0].id;
      await mutate("post", "/api/admin/products", invalid).expect(400);
      const collision = fixture(categoryId);
      collision.variants[1].sku = laptop.variants[0].sku;
      await mutate("post", "/api/admin/products", collision).expect(409);
      const stolen = fixture(categoryId);
      stolen.options[0].id = laptop.options[0].id;
      await mutate("post", "/api/admin/products", stolen).expect(400);
      const badDelete = writeBody(laptop);
      badDelete.options[0].values.shift();
      await mutate("put", `/api/admin/products/${laptop.id}`, badDelete).expect(
        400,
      );
      const wrongCategory = fixture(randomUUID());
      await mutate("post", "/api/admin/products", wrongCategory).expect(400);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM products")).rows[0].n,
        before,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT quantity FROM inventory WHERE variant_id=$1",
            [laptop.variants[0].id],
          )
        ).rows[0].quantity,
        laptop.variants[0].quantity,
      );
    },
  );

  await t.test(
    "database rejects incomplete, duplicate and cross-product selections and unsafe deletion",
    async () => {
      const transactionFails = async (operation, code) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          await assert.rejects(
            async () => {
              await operation(c);
              await c.query("COMMIT");
            },
            { code },
          );
        } finally {
          await c.query("ROLLBACK");
          c.release();
        }
      };
      await transactionFails(
        (c) =>
          c.query("DELETE FROM variant_option_values WHERE variant_id=$1", [
            laptop.variants[0].id,
          ]),
        "23514",
      );
      await transactionFails(
        (c) =>
          c.query(
            "UPDATE variant_option_values SET option_value_id=$1 WHERE variant_id=$2 AND option_id=$3",
            [
              single.options[0].values[0].id,
              laptop.variants[0].id,
              laptop.options[0].id,
            ],
          ),
        "23503",
      );
      await transactionFails(
        (c) =>
          c.query("DELETE FROM product_option_values WHERE id=$1", [
            laptop.options[0].values[0].id,
          ]),
        "23503",
      );
      await transactionFails(
        (c) =>
          c.query("DELETE FROM product_variants WHERE id=$1", [
            laptop.images[0].variantId,
          ]),
        "23503",
      );
      await transactionFails(
        (c) =>
          c.query(
            "INSERT INTO product_options(id,product_id,name,position) VALUES ($1,$2,' ram ',7)",
            [randomUUID(), laptop.id],
          ),
        "23505",
      );
      await transactionFails(
        (c) =>
          c.query(
            "INSERT INTO product_option_values(id,product_id,option_id,value,position) VALUES ($1,$2,$3,' first ',9)",
            [randomUUID(), laptop.id, laptop.options[0].id],
          ),
        "23505",
      );
      await transactionFails(async (c) => {
        const id = randomUUID();
        await c.query(
          "INSERT INTO product_variants(id,product_id,sku,price_minor) VALUES ($1,$2,$3,1)",
          [id, laptop.id, randomUUID()],
        );
        await c.query(
          "INSERT INTO variant_option_values(product_id,variant_id,option_id,option_value_id) SELECT product_id,$1,option_id,option_value_id FROM variant_option_values WHERE variant_id=$2",
          [id, laptop.variants[0].id],
        );
      }, "23505");
      await transactionFails(
        (c) =>
          c.query(
            "INSERT INTO product_variants(id,product_id,sku,price_minor) VALUES ($1,$2,$3,1)",
            [randomUUID(), simple.id, randomUUID()],
          ),
        "23505",
      );
      await transactionFails(
        (c) =>
          c.query("UPDATE products SET specifications='[]' WHERE id=$1", [
            simple.id,
          ]),
        "23514",
      );
      await transactionFails(
        (c) =>
          c.query(
            "INSERT INTO product_images(id,product_id,variant_id,storage_key,alt_text,width,height,position) VALUES ($1,$2,$3,'products/wrong.webp','Wrong',1,1,9)",
            [randomUUID(), simple.id, laptop.variants[0].id],
          ),
        "23503",
      );
    },
  );

  await t.test(
    "updates retain identities and image links, handle visibility and reject stale saves",
    async () => {
      const body = writeBody(laptop);
      body.variants[0].priceMinor = 29900;
      body.variants[0].quantity = 10;
      body.variants[1].active = false;
      body.options[0].name = "Memory";
      laptop = (
        await mutate("put", `/api/admin/products/${laptop.id}`, body).expect(
          200,
        )
      ).body.product;
      assert.equal(laptop.options[0].name, "Memory");
      assert.equal(laptop.variants[0].priceMinor, 29900);
      assert.equal(laptop.variants[0].quantity, 10);
      assert.equal(laptop.images[0].id, body.images[0].id);
      await mutate("put", `/api/admin/products/${laptop.id}`, body).expect(409);
      let p = (await request(app).get(`/api/products/${laptop.id}`).expect(200))
        .body.product;
      assert.equal(p.variants.length, 1);
      assert.equal(p.variants[0].inStock, true);
      const draft = writeBody(laptop);
      draft.status = "draft";
      laptop = (
        await mutate("put", `/api/admin/products/${laptop.id}`, draft).expect(
          200,
        )
      ).body.product;
      await request(app).get(`/api/products/${laptop.id}`).expect(404);
      assert.equal(
        (await agent.get(`/api/admin/products/${laptop.id}`).expect(200)).body
          .product.variants.length,
        2,
      );
      const beforeVersion = laptop.version;
      await pool.query(
        "UPDATE inventory SET quantity=quantity+1 WHERE variant_id=$1",
        [laptop.variants[0].id],
      );
      assert.notEqual(
        (await agent.get(`/api/admin/products/${laptop.id}`)).body.product
          .version,
        beforeVersion,
      );
      await mutate(
        "put",
        `/api/admin/products/${laptop.id}`,
        writeBody(laptop),
      ).expect(409);
    },
  );

  await t.test(
    "complete replacements can safely remove options and preserve retained stock and image identities",
    async () => {
      const body = writeBody(single);
      body.options = [];
      body.variants = [{ ...body.variants[0], optionValueIds: [] }];
      const changed = (
        await mutate("put", `/api/admin/products/${single.id}`, body).expect(
          200,
        )
      ).body.product;
      assert.equal(changed.options.length, 0);
      assert.equal(changed.variants.length, 1);
      assert.equal(changed.variants[0].id, single.variants[0].id);
      assert.equal(changed.variants[0].quantity, single.variants[0].quantity);
      assert.equal(changed.images[0].id, single.images[0].id);
      assert.equal(
        (
          await pool.query("SELECT 1 FROM inventory WHERE variant_id=$1", [
            single.variants[1].id,
          ])
        ).rowCount,
        0,
      );
    },
  );

  await t.test(
    "simultaneous updates with one version allow only one writer",
    async () => {
      const latest = (
        await agent.get(`/api/admin/products/${laptop.id}`).expect(200)
      ).body.product;
      const results = await Promise.all([
        mutate("put", `/api/admin/products/${laptop.id}`, writeBody(latest)),
        mutate("put", `/api/admin/products/${laptop.id}`, writeBody(latest)),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    },
  );

  await t.test(
    "bounded large configurations fit the admin parser and public detail contract",
    async () => {
      const body = fixture(categoryId);
      body.options.forEach((o) => {
        o.values = Array.from({ length: 16 }, (_, i) => ({
          id: randomUUID(),
          value: `Value ${i}`,
        }));
      });
      body.variants = Array.from({ length: 250 }, (_, i) => ({
        id: randomUUID(),
        sku: randomUUID(),
        priceMinor: 100,
        quantity: 1,
        currency: "SEK",
        active: true,
        optionValueIds: [
          body.options[0].values[Math.floor(i / 16)].id,
          body.options[1].values[i % 16].id,
        ],
      }));
      assert.ok(Buffer.byteLength(JSON.stringify(body)) > 16384);
      const created = (
        await mutate("post", "/api/admin/products", body).expect(201)
      ).body.product;
      assert.equal(
        (await request(app).get(`/api/products/${created.id}`).expect(200)).body
          .product.variants.length,
        250,
      );
      body.variants.push({
        ...body.variants[0],
        id: randomUUID(),
        sku: randomUUID(),
      });
      await mutate("post", "/api/admin/products", body).expect(400);
    },
  );

  await t.test(
    "admin mutation authorization, CSRF and body limits are enforced",
    async () => {
      await request(app)
        .post("/api/admin/products")
        .send(fixture(categoryId))
        .expect(401);
      await agent
        .post("/api/admin/products")
        .send(fixture(categoryId))
        .expect(403);
      await mutate("post", "/api/admin/products", {
        padding: "x".repeat(530000),
      }).expect(413);
      await pool.query(
        "UPDATE users SET role='customer' WHERE email='dynamic@example.com'",
      );
      await mutate("post", "/api/admin/products", fixture(categoryId)).expect(
        403,
      );
    },
  );
});
