# Shoply product ER diagram

Open [the interactive table relationship map](shoply-products.html) for the architecture view and table/constraint cards. [shoply-products.mmd](shoply-products.mmd) is the full Mermaid ER source, including all columns, for pasting into another AI or Mermaid-compatible editor.

The model reflects the current local migrations [002_catalog.sql](../../backend/migrations/002_catalog.sql) and [003_dynamic_options.sql](../../backend/migrations/003_dynamic_options.sql), after removal of legacy color/size columns. The workspace has no Git metadata; no commit-pinned repository provenance is claimed. Authentication tables are intentionally outside this product-focused scope.

## Reading the ER source

- `PK`: primary key, identifying one row. Multiple PK markers in the same table mean one composite primary key.
- `FK`: foreign key, sometimes one column of a composite foreign key.
- `UK`: globally unique field. Scoped/composite uniqueness is written in the field comments instead.
- `||`: exactly one. `o{`: zero or many. `|{`: one or many. `o|` / `|o`: zero or one.
- Each variant can have at most one inventory record; catalog reads treat a missing record as zero stock.
- An image always belongs to one product. It optionally belongs to one variant of that same product.
- An option must have at least one allowed value. A variant must select exactly one value for every product option. A simple/default variant has no selection rows. Legacy products without variants remain possible, while new admin saves require at least one.

## Composite constraints not fully expressed by individual ER lines

```text
product_option_values(product_id, option_id)
  -> product_options(product_id, id)

variant_option_values(product_id, variant_id)
  -> product_variants(product_id, id)

variant_option_values(product_id, option_id, option_value_id)
  -> product_option_values(product_id, option_id, id)

product_images(product_id, variant_id)
  -> product_variants(product_id, id)
```

The selection table's composite primary key is `(variant_id, option_id)`: a variant cannot select two values from the same option. Same-product composite foreign keys prevent using another product's values or attaching an image to another product's variant.

Deferred checks enforce complete variant selections at transaction commit. A database-derived combination key with `UNIQUE(product_id, combination_key)` prevents duplicate combinations, including multiple default variants of a simple product. Other limits: 8 options per product, 100 values per option, 250 variants and 50 images per product. Positions are unique and nonnegative; option names and value labels are unique within their parent ignoring case and surrounding whitespace. Prices and inventory are nonnegative integers; currency is SEK; specifications must be a JSON object.

## Example: Red + EU 42 (illustrative)

```text
products:              P1 = Everyday sneaker
product_options:       O1 = Color, O2 = Size (both belong to P1)
product_option_values: RED belongs to O1; S42 belongs to O2
product_variants:      V1 belongs to P1; SKU SHOE-RED-42; price_minor 44900
variant_option_values: (P1, V1, O1, RED)
                       (P1, V1, O2, S42)
inventory:             variant_id V1; quantity 8
```

Selecting RED and S42 matches V1's selections. V1 determines price/SKU; inventory determines availability. Allowed values do not automatically create every theoretical purchasable combination. Example IDs are abbreviated; actual IDs are UUIDs.

The HTML architecture artifact passed Archify validation, generation, strict provenance checks and automated real-browser checks. Its [finalize summary](shoply-products.finalize-summary.json) records these results. No manual perceptual review was performed. The Mermaid ER source is a separate editable representation; its relationships and columns were checked against the migration files, but it was not separately browser-rendered.
