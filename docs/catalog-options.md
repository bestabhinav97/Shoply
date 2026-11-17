# Dynamic product options

Products hold shared information and JSON-object specifications. Selectable attributes belong in relational option tables, never in specifications. No category-specific code is needed to add RAM, Storage, Fit, Material or another option.

## Relationships and integrity

```text
categories -> products -> product_options -> product_option_values
                    |                              |
                    -> product_variants <-> variant_option_values
                              |
                              -> inventory
products -> product_images -> optional product_variant
```

- Options have UUIDs, product ownership, names, zero-based positions and creation/update timestamps. Names are unique per product after trimming whitespace and lowercasing. Positions are unique per product.
- Values have UUIDs, option/product ownership, nonempty labels and positions. Labels are normalized for uniqueness within their option. Positions are unique per option.
- Selections contain product, variant, option and value IDs. Their `(variant_id, option_id)` primary key permits only one selection per option. Composite foreign keys enforce that the variant, option and selected value all belong to the same product.
- Deferred constraint triggers validate complete configurations at transaction end: every option needs values and every variant needs exactly one selection for every option. All options are required; optional attributes are not part of this model.
- `combination_key` is a sorted comma-separated list of selected value UUIDs, derived exclusively by database triggers. A deferred unique constraint on `(product_id, combination_key)` rejects duplicate combinations, including duplicate simple/default variants. Request bodies cannot set this identity.
- Product children serialize writes on the parent product. Option and variant changes can be saved together without exposing a partial configuration. Parent `updated_at` also changes on child and inventory writes for optimistic concurrency.
- Variant IDs, SKU uniqueness, nonnegative integer öre prices, SEK currency and nonnegative inventory remain authoritative in PostgreSQL. Inventory uses variant IDs as its primary/foreign key.
- Images retain the existing composite same-product variant reference. Removing a selected value or variant directly fails while a restrictive reference remains. Product deletion still cascades its owned graph; variant deletion cascades inventory. The admin replacement transaction explicitly reconciles image/selection references before deleting omitted variants/options.
- Existing indexes support listings/category status, SKU lookup, option ownership, ordered values, variant ownership and junction lookups. Product detail uses four fixed queries in one repeatable-read snapshot, rather than issuing an application query per variant.

## Public details

`GET /api/products/:uuid` keeps the `{ product }` wrapper. A product includes shared fields, `specifications`, `options`, `variants`, and `images`. Options and values are ordered by position. Each variant includes its `optionValueIds`, SKU, priceMinor, currency, active and inStock. Only active variants of active products are returned; exact inventory, status and edit version stay private. Images linked exclusively to inactive variants stay private. All option definitions are returned, including allowed values without a currently active combination.

The client stores an option-to-value selection map, preserves other selections when one changes, and resolves only actual variants. Missing combinations show an unavailable message and no stale price/SKU. Out-of-stock variants remain selectable for inspection. Variant-specific images precede shared images when available. Simple products show no selectors. Purchasing remains unavailable because this project has no cart/checkout implementation yet.

## Admin request contract

`POST /api/admin/products` creates; `PUT /api/admin/products/:uuid` replaces the entire editable configuration. Both require a current admin session, exact configured Origin, application/json and an `X-CSRF-Token` issued by `/api/auth/csrf`. Bodies are limited to 512 KB after auth/CSRF. No public mutation endpoint exists.

Child UUIDs are supplied by the editor using `crypto.randomUUID()`. New API clients must allocate unique UUIDs for new options, values, variants and images and reuse existing UUIDs when editing. Product UUIDs are generated on the server. IDs from another product are rejected. Existing values cannot be moved between options. Array order defines option, value and image positions; omit `position` in writes. Definitions are bounded to 8 options, 100 values per option, 250 variants and 50 images per product in both API and database. New admin writes need at least one variant; legacy zero-variant products can still be read administratively but need a variant before saving.

Example body (replace categoryId with an existing category UUID):

```json
{
  "categoryId": "10000000-0000-4000-8000-000000000001",
  "slug": "work-laptop",
  "name": "Work laptop",
  "description": "Shared product description.",
  "status": "draft",
  "specifications": { "screen_size": "15.6 inches", "battery": "80Wh" },
  "options": [
    {
      "id": "20000000-0000-4000-8000-000000000001",
      "name": "RAM",
      "values": [
        { "id": "30000000-0000-4000-8000-000000000001", "value": "16GB" },
        { "id": "30000000-0000-4000-8000-000000000002", "value": "32GB" }
      ]
    }
  ],
  "variants": [
    {
      "id": "40000000-0000-4000-8000-000000000001",
      "sku": "WORK-LAPTOP-16",
      "optionValueIds": ["30000000-0000-4000-8000-000000000001"],
      "priceMinor": 999900,
      "currency": "SEK",
      "quantity": 12,
      "active": true
    }
  ],
  "images": [
    {
      "id": "50000000-0000-4000-8000-000000000001",
      "variantId": "40000000-0000-4000-8000-000000000001",
      "storageKey": "products/work-laptop.webp",
      "alt": "Work laptop with its screen open",
      "width": 800,
      "height": 1000
    }
  ]
}
```

This example has one actual variant; the allowed 32GB value does not automatically create one. For a simple product use `options: []` and one variant with `optionValueIds: []`. Shared images use `variantId: null`. Specifications must be a JSON object (nested JSON values are allowed). Image keys reference existing media; they neither upload files nor import remote images. Categories can be created with the admin-only `POST /api/admin/products/categories` endpoint using `{ name, slug }`. Names are unique ignoring case and surrounding whitespace; slugs are unique. Creation returns `{ category: { id, name, slug } }` with status 201 and is independent of saving a product.

Admin GET and save responses contain `{ product }` plus exact variant quantities, all inactive variants, product status, categoryId, image IDs/storage keys, and an opaque `version`. Convert the read response to the write shape above, excluding read-only `id`, `category`, positions, image URLs, inStock and the product wrapper. On PUT include the last read `version` unchanged. After a successful save use the newly returned version. Concurrent/stale saves return 409; reload and reconcile edits. Validation errors are 400 with message and optional field errors. Uniqueness conflicts are 409. Unknown IDs are 404. GET categories at `/api/admin/products/categories` returns all existing categories.

Omitting existing children on PUT explicitly removes them. Retained variants keep their IDs; deleting a variant removes its inventory. Any retained image must reference a retained variant. Every retained variant must use the final complete option configuration. The editor disables deleting referenced definitions/images until dependencies are addressed. No automatic Cartesian-product generation is performed. Renaming/reordering definitions preserves IDs and selections; conflicting names/values are rejected rather than silently merged.

## Migration and recovery

1. Stop catalog writers and back up the database and media before deployment. Deploy the API/frontend and schema together; old color/size API clients are incompatible after this change.
2. Apply `npm run db:migrate` using the configured development database (or the deployment migration process for other environments). Do not reset, reseed or wipe an existing catalog. The existing migration runner locks migrations and wraps SQL plus migration records in one transaction.
3. `003_dynamic_options.sql` checks for mixed NULL/populated values within each product and combinations that would collide after normalization. A product where every variant has color but no size is valid. A product where only some variants have color is ambiguous and migration stops. The error is actionable; inspect the affected products and correct their intended combinations before retrying. No placeholder selection is invented.
4. The migration creates Color/Size options and distinct allowed values for existing selections, inserts junction rows, and derives identities before building the combination unique index. It verifies complete configurations before dropping the old columns. Variant UUIDs, SKUs, prices, currency, activation, inventory and image IDs/relationships remain intact. Existing normalized-equivalent value labels are reused, not duplicated. New options get Color then Size ordering; old value display order is deterministic by normalized label.
5. If any check fails (including catalog limits), the whole migration rolls back and the old columns/data remain available. Correct legacy data or plan a larger-configuration API before retrying. Migration records prevent accidental reapplication. Backups are the recovery path after a successful schema upgrade; no lossy down migration is supplied. Restore a backup into a **separate database**, verify it with the previous application version, then deliberately switch configuration if rollback is needed. Do not blindly overwrite an active database or discard post-upgrade writes.

Useful preflight query for mixed optional legacy columns, to run **before** migration:

```sql
SELECT product_id
FROM product_variants
GROUP BY product_id
HAVING (bool_or(color IS NOT NULL) AND bool_or(color IS NULL))
    OR (bool_or(size IS NOT NULL) AND bool_or(size IS NULL));
```

## Verification

`npm test` uses isolated random PostgreSQL schemas and React Testing Library. Coverage includes legacy data migration and rollback; shoe/laptop/simple/one-option/three-option configurations; missing/duplicate/incomplete combinations; normalized names/values; cross-product references; database-level checks; public/admin visibility; retained image/stock identities; stale edits; failed-write rollback; a 250-variant graph; authorization and CSRF; dynamic customer selection and admin editing. Run `npm run lint` and `npm run build` as well. No new configuration variables or dependencies are required.

Limits are deliberate for this complete-graph editor/API. For products exceeding them, introduce pagination or a variant-resolution endpoint before increasing database limits. Checkout, stock reservations, uploads and full category editing/deletion are future work. New category creation is available inline in the product creation flow.

## Admin catalog and creation flow

The admin list accepts public list parameters plus `status` (`draft`, `active`, `archived`) and `availability` (`in-stock`, `out-of-stock`). The `q` term also searches variant SKUs, including inactive variants, on admin reads only. Filters are combined in SQL before pagination; no entire catalog is loaded into the browser. Public reads continue rejecting admin-only parameters. Admin list rows now also include a representative image or null.

New-product creation at `/admin/products/new` uses five steps: details, options, variants, images and review. Each step checks its own configuration before advancing; going back retains entries. The final submission revalidates the entire graph and uses the existing transactional POST. Specifications are entered as optional name/value rows. Prices are entered in SEK (dot or comma decimals, at most two places) and converted exactly to integer minor units. Categories can be created and selected without losing the product form. Categories are saved immediately and remain available if the product is cancelled; product/options/variants/inventory/images are saved together only on the final review. Editing routes retain their previous behavior and are not exposed as actions on the refreshed catalog page.

`004_category_names.sql` checks existing categories before adding a unique index on normalized names. Duplicate names ignoring case and surrounding whitespace, or whitespace-only names, abort migration with a corrective error instead of merging or deleting data. Category POST requires the same admin session, origin and CSRF protections as product creation, with a 16 KB JSON limit; duplicate name/slug errors return 409. No new environment variables or dependencies are required.
