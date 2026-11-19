import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import express from "express";
import request from "supertest";
import { env } from "../config/env.js";
import { validateList } from "../modules/products/product.validation.js";
import { createLimiter } from "../shared/rateLimits.js";
import argon2 from "argon2";
import { products } from "../seeds/products.js";

test("catalog query validation rejects invalid and unbounded requests", () => {
  assert.deepEqual(validateList({}), {
    q: "",
    sort: "newest",
    page: 1,
    limit: 12,
  });

  for (const query of [
    { page: "0" },
    { page: "10000" },
    { limit: "49" },
    { limit: "1.5" },
    { sort: "price; DROP TABLE products" },
    { q: "x".repeat(101) },
    { q: ["shoe", "mug"] },
    { status: "draft" },
    { category: "../private" },
  ]) {
    assert.throws(() => validateList(query), { status: 400 });
  }
});

test("rate limits return JSON, retry information and stop excess requests", async () => {
  const app = express();
  app.use(createLimiter(2));
  app.get("/", (_req, res) => res.json({ ok: true }));

  await request(app).get("/").expect(200);
  await request(app).get("/").expect(200);
  const limited = await request(app).get("/").expect(429);

  assert.ok(limited.headers["retry-after"]);
  assert.ok(limited.headers.ratelimit);
  assert.match(limited.body.message, /Too many requests/);
});

test("catalog API and seeds against an isolated PostgreSQL schema", async (t) => {
  const schema = `catalog_test_${randomBytes(8).toString("hex")}`;
  const admin = new pg.Pool(env.db);
  await admin.query(`CREATE SCHEMA ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema}`;

  const { pool } = await import("../db/db.js");
  const { migrate } = await import("../db/migrate.js");
  const { seedProducts } = await import("../scripts/seed-products.js");

  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    delete process.env.PGOPTIONS;
  });

  await migrate();
  await migrate();
  const { default: app } = await import("../app.js");

  await t.test("empty catalog returns consistent pagination", async () => {
    const response = await request(app).get("/api/products").expect(200);
    assert.deepEqual(response.body, {
      items: [],
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
    });
  });

  await t.test("seed data is persisted and safe to run twice", async () => {
    assert.equal(await seedProducts(), products.length);
    assert.equal(await seedProducts(), 0);
    assert.equal(
      (await pool.query("SELECT count(*)::integer AS n FROM products")).rows[0]
        .n,
      products.length,
    );
  });

  let shoe;

  await t.test(
    "admin catalog enforces sessions and current database roles",
    async () => {
      await request(app).get("/api/admin/products").expect(401);

      const password = "catalog test passphrase";
      const hash = await argon2.hash(password, { type: argon2.argon2id });
      const userId = randomUUID();
      await pool.query(
        `INSERT INTO users (id, first_name, last_name, phone_number, email, password_hash)
      VALUES ($1, 'Catalog', 'Tester', '', 'catalog@example.com', $2)`,
        [userId, hash],
      );

      const { login } = await import("../modules/auth/auth.service.js");
      const { sessionCookie } = await import("../modules/auth/auth.cookies.js");
      const { token } = await login({ email: "catalog@example.com", password });
      const cookie = `${sessionCookie}=${token}`;
      await request(app)
        .get("/api/admin/products")
        .set("Cookie", cookie)
        .expect(403);

      await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [
        userId,
      ]);
      const productId = (await pool.query("SELECT id FROM products LIMIT 1"))
        .rows[0].id;
      await pool.query("UPDATE products SET status = 'draft' WHERE id = $1", [
        productId,
      ]);

      const adminList = await request(app)
        .get("/api/admin/products?limit=48")
        .set("Cookie", cookie)
        .expect(200);
      assert.equal(adminList.body.pagination.total, products.length);
      assert.ok(
        adminList.body.items.some(
          (product) => product.id === productId && product.status === "draft",
        ),
      );
      assert.equal(adminList.headers["cache-control"], "no-store");
      const publicList = await request(app).get("/api/products").expect(200);
      assert.equal(publicList.body.pagination.total, products.length - 1);
      assert.ok(
        publicList.body.items.every(
          (product) => product.id !== productId && product.status === undefined,
        ),
      );
      await request(app)
        .get("/api/admin/products?limit=100")
        .set("Cookie", cookie)
        .expect(400);

      await pool.query("UPDATE users SET role = 'customer' WHERE id = $1", [
        userId,
      ]);
      await request(app)
        .get("/api/admin/products")
        .set("Cookie", cookie)
        .expect(403);
      await pool.query("UPDATE products SET status = 'active' WHERE id = $1", [
        productId,
      ]);
    },
  );

  await t.test(
    "listing supports pagination, categories, search and stable price sorting",
    async () => {
      const response = await request(app)
        .get("/api/products?sort=price-asc&limit=5")
        .expect(200);
      assert.equal(response.body.items.length, 5);
      assert.equal(response.body.pagination.total, products.length);
      assert.equal(
        response.body.pagination.totalPages,
        Math.ceil(products.length / 5),
      );
      const prices = response.body.items.map((item) => item.priceMinor);
      assert.deepEqual(
        prices,
        [...prices].sort((a, b) => a - b),
      );
      assert.equal(response.body.items[0].currency, "SEK");
      assert.match(
        response.body.items[0].image.url,
        /^\/images\/products\/[a-z-]+\.webp$/,
      );

      const shoes = await request(app)
        .get("/api/products?category=shoes&q=sneaker")
        .expect(200);
      assert.equal(shoes.body.pagination.total, 2);
      shoe = shoes.body.items.find(
        (item) => item.slug === "everyday-white-sneaker",
      );

      const outside = await request(app)
        .get("/api/products?page=99")
        .expect(200);
      assert.equal(outside.body.pagination.total, products.length);
      assert.deepEqual(outside.body.items, []);

      for (const q of ["%", "_", "'; DROP TABLE products; --"]) {
        const search = await request(app)
          .get("/api/products")
          .query({ q })
          .expect(200);
        assert.equal(search.body.pagination.total, 0);
      }

      const categories = await request(app).get("/api/categories").expect(200);
      assert.equal(categories.body.items.length, 4);
      assert.ok(response.headers.ratelimit);
    },
  );

  await t.test(
    "details expose variant prices and availability, without internal quantities",
    async () => {
      const response = await request(app)
        .get(`/api/products/${shoe.id}`)
        .expect(200);
      const product = response.body.product;
      assert.equal(product.variants.length, 4);
      assert.deepEqual(
        product.options.map((o) => o.name),
        ["Color", "Size"],
      );
      assert.equal(product.options[1].values[0].value, "EU 40");
      assert.deepEqual(product.variants[0].optionValueIds, [
        product.options[0].values[0].id,
        product.options[1].values[0].id,
      ]);
      assert.equal(product.variants[0].priceMinor, 44900);
      assert.equal(product.variants[3].inStock, false);
      assert.equal(product.variants[0].quantity, undefined);
      assert.equal(product.images.length, 1);

      await pool.query(
        "UPDATE product_variants SET price_minor = 45900 WHERE id = $1",
        [product.variants[1].id],
      );
      const listing = await request(app)
        .get("/api/products?q=everyday%20white")
        .expect(200);
      assert.equal(listing.body.items[0].hasPriceRange, true);
      assert.equal(listing.body.items[0].priceMinor, 44900);
    },
  );

  await t.test(
    "invalid input is rejected and no public writes exist",
    async () => {
      for (const query of [
        "limit=100",
        "page=-1",
        "sort=bad",
        "q=a&q=b",
        "status=draft",
      ]) {
        await request(app).get(`/api/products?${query}`).expect(400);
      }
      await request(app).get("/api/products/not-an-id").expect(400);
      await request(app).get(`/api/products/${randomUUID()}`).expect(404);
      await request(app)
        .post("/api/products")
        .send({ name: "Injected product" })
        .expect(404);
    },
  );

  await t.test(
    "draft, archived and variant-less products remain private",
    async () => {
      for (const status of ["draft", "archived"]) {
        await pool.query("UPDATE products SET status = $1 WHERE id = $2", [
          status,
          shoe.id,
        ]);
        await request(app).get(`/api/products/${shoe.id}`).expect(404);
        const list = await request(app)
          .get("/api/products?category=shoes")
          .expect(200);
        assert.equal(
          list.body.pagination.total,
          products.filter((product) => product.category === "shoes").length - 1,
        );
      }

      await pool.query("UPDATE products SET status = 'active' WHERE id = $1", [
        shoe.id,
      ]);
      await pool.query(
        "UPDATE product_variants SET active = false WHERE product_id = $1",
        [shoe.id],
      );
      await request(app).get(`/api/products/${shoe.id}`).expect(404);
    },
  );

  await t.test(
    "rerunning seeds preserves renamed products, edited prices and stock",
    async () => {
      const variant = (
        await pool.query(
          "SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1",
          [shoe.id],
        )
      ).rows[0];
      await pool.query(
        "UPDATE products SET slug = 'admin-renamed-shoe', name = 'Edited shoe' WHERE id = $1",
        [shoe.id],
      );
      await pool.query(
        "UPDATE product_variants SET price_minor = 12345 WHERE id = $1",
        [variant.id],
      );
      await pool.query(
        "UPDATE inventory SET quantity = 2 WHERE variant_id = $1",
        [variant.id],
      );
      assert.equal(await seedProducts(), 0);
      const result = await pool.query(
        "SELECT price_minor, quantity FROM product_variants JOIN inventory ON variant_id = id WHERE id = $1",
        [variant.id],
      );
      assert.equal(result.rows[0].price_minor, 12345);
      assert.equal(result.rows[0].quantity, 2);
      assert.equal(
        (await pool.query("SELECT name FROM products WHERE id = $1", [shoe.id]))
          .rows[0].name,
        "Edited shoe",
      );
    },
  );

  await t.test("production refuses demo seeding", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      await assert.rejects(seedProducts(), /disabled in production/);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  await t.test(
    "database constraints reject invalid prices, stock and duplicate options",
    async () => {
      const { rows } = await pool.query(
        "SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1",
        [shoe.id],
      );

      await assert.rejects(
        pool.query(
          "UPDATE product_variants SET price_minor = -1 WHERE id = $1",
          [rows[0].id],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        pool.query("UPDATE inventory SET quantity = -1 WHERE variant_id = $1", [
          rows[0].id,
        ]),
        { code: "23514" },
      );
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const duplicateId = randomUUID();
        await client.query(
          `INSERT INTO product_variants(id,product_id,sku,price_minor)
          SELECT $1,product_id,'DUPLICATE-OPTIONS',price_minor FROM product_variants WHERE id=$2`,
          [duplicateId, rows[0].id],
        );
        await client.query(
          `INSERT INTO variant_option_values(product_id,variant_id,option_id,option_value_id)
          SELECT product_id,$1,option_id,option_value_id FROM variant_option_values WHERE variant_id=$2`,
          [duplicateId, rows[0].id],
        );
        await assert.rejects(client.query("COMMIT"), { code: "23505" });
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    },
  );
});
