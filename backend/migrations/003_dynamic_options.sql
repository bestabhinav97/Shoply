-- Normalization matches API trimming for whitespace and is shared by indexes/migration.
CREATE FUNCTION catalog_trim(label text) RETURNS text LANGUAGE sql IMMUTABLE STRICT
  RETURN regexp_replace(label, '^\s+|\s+$', '', 'g');

-- The migration runner wraps this file and its migration record in one transaction.
-- Stop before changing data when legacy selections cannot be mapped faithfully.
DO $$
BEGIN
  IF EXISTS (
    SELECT product_id FROM product_variants GROUP BY product_id
    HAVING (bool_or(color IS NOT NULL) AND bool_or(color IS NULL))
        OR (bool_or(size IS NOT NULL) AND bool_or(size IS NULL))
  ) THEN
    RAISE EXCEPTION 'Dynamic options migration: mixed NULL/populated color or size within a product. Resolve incomplete legacy combinations and retry.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM product_variants
    GROUP BY product_id, lower(catalog_trim(color)), lower(catalog_trim(size)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Dynamic options migration: combinations collide after trimming/case normalization. Resolve duplicate legacy combinations and retry.';
  END IF;
END $$;

ALTER TABLE products ADD COLUMN specifications jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(specifications) = 'object');

CREATE TABLE product_options (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(catalog_trim(name)) BETWEEN 1 AND 100),
  position integer NOT NULL CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, id),
  UNIQUE (product_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX product_options_name_idx ON product_options(product_id, lower(catalog_trim(name)));

CREATE TABLE product_option_values (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL,
  option_id uuid NOT NULL,
  value text NOT NULL CHECK (length(catalog_trim(value)) BETWEEN 1 AND 100),
  position integer NOT NULL CHECK (position >= 0),
  FOREIGN KEY (product_id, option_id) REFERENCES product_options(product_id, id) ON DELETE CASCADE,
  UNIQUE (product_id, option_id, id),
  UNIQUE (option_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX product_option_values_name_idx ON product_option_values(option_id, lower(catalog_trim(value)));

CREATE TABLE variant_option_values (
  product_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  option_id uuid NOT NULL,
  option_value_id uuid NOT NULL,
  PRIMARY KEY (variant_id, option_id),
  FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, option_id, option_value_id)
    REFERENCES product_option_values(product_id, option_id, id)
);
CREATE INDEX variant_option_values_value_idx ON variant_option_values(option_value_id);
CREATE INDEX variant_option_values_product_idx ON variant_option_values(product_id);
CREATE INDEX product_option_values_product_idx ON product_option_values(product_id);

INSERT INTO product_options(id, product_id, name, position)
SELECT gen_random_uuid(), product_id, 'Color', 0 FROM product_variants WHERE color IS NOT NULL GROUP BY product_id;
INSERT INTO product_options(id, product_id, name, position)
SELECT gen_random_uuid(), v.product_id, 'Size',
  CASE WHEN EXISTS (SELECT 1 FROM product_options o WHERE o.product_id = v.product_id) THEN 1 ELSE 0 END
FROM product_variants v WHERE size IS NOT NULL GROUP BY v.product_id;

INSERT INTO product_option_values(id, product_id, option_id, value, position)
SELECT gen_random_uuid(), product_id, option_id, value,
  row_number() OVER (PARTITION BY option_id ORDER BY lower(value)) - 1
FROM (
  SELECT o.product_id, o.id AS option_id, min(catalog_trim(v.color)) AS value
  FROM product_options o JOIN product_variants v ON v.product_id = o.product_id
  WHERE o.name = 'Color' GROUP BY o.product_id, o.id, lower(catalog_trim(v.color))
  UNION ALL
  SELECT o.product_id, o.id, min(catalog_trim(v.size))
  FROM product_options o JOIN product_variants v ON v.product_id = o.product_id
  WHERE o.name = 'Size' GROUP BY o.product_id, o.id, lower(catalog_trim(v.size))
) values_to_migrate;

INSERT INTO variant_option_values(product_id, variant_id, option_id, option_value_id)
SELECT v.product_id, v.id, o.id, ov.id
FROM product_variants v JOIN product_options o ON o.product_id = v.product_id
JOIN product_option_values ov ON ov.option_id = o.id
  AND lower(ov.value) = lower(catalog_trim(CASE o.name WHEN 'Color' THEN v.color ELSE v.size END));

ALTER TABLE product_variants ADD COLUMN combination_key text NOT NULL DEFAULT '';
-- Populate identities BEFORE building the unique index: an existing product may
-- already have many variants, which cannot all share the temporary empty key.
UPDATE product_variants v SET combination_key = expected.key
FROM (
  SELECT pv.id, coalesce(string_agg(s.option_value_id::text, ',' ORDER BY s.option_value_id), '') AS key
  FROM product_variants pv LEFT JOIN variant_option_values s ON s.variant_id = pv.id GROUP BY pv.id
) expected WHERE v.id = expected.id;
ALTER TABLE product_variants ADD CONSTRAINT product_variants_combination_unique
  UNIQUE (product_id, combination_key) DEFERRABLE INITIALLY DEFERRED;

-- Serialize catalog graph changes per product, including direct SQL writes.
CREATE FUNCTION lock_catalog_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE products SET updated_at = clock_timestamp() WHERE id = OLD.product_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF TG_OP = 'UPDATE' AND NEW.product_id <> OLD.product_id THEN
      RAISE EXCEPTION 'Moving catalog children between products is not supported' USING ERRCODE = '23514';
    END IF;
    UPDATE products SET updated_at = clock_timestamp() WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;

-- Validate the final transaction state, allowing options and variants to be
-- inserted/changed together. The key is always derived from junction rows.
CREATE FUNCTION validate_catalog_product(pid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE option_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = pid) THEN RETURN; END IF;
  SELECT count(*) INTO option_count FROM product_options WHERE product_id = pid;
  IF option_count > 8
    OR (SELECT count(*) FROM product_variants WHERE product_id = pid) > 250
    OR EXISTS (SELECT 1 FROM product_option_values WHERE product_id = pid GROUP BY option_id HAVING count(*) > 100)
    OR (SELECT count(*) FROM product_images WHERE product_id = pid) > 50 THEN
    RAISE EXCEPTION 'Catalog limit exceeded: 8 options, 100 values per option, 250 variants, 50 images per product' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM product_options o WHERE o.product_id = pid
      AND NOT EXISTS (SELECT 1 FROM product_option_values ov WHERE ov.option_id = o.id)
  ) OR EXISTS (
    SELECT 1 FROM product_variants v LEFT JOIN variant_option_values s ON s.variant_id = v.id
    WHERE v.product_id = pid GROUP BY v.id HAVING count(s.option_id) <> option_count
  ) THEN
    RAISE EXCEPTION 'Each option needs values and every variant must select exactly one value per option' USING ERRCODE = '23514';
  END IF;
  UPDATE product_variants v SET combination_key = expected.key
  FROM (
    SELECT pv.id, coalesce(string_agg(s.option_value_id::text, ',' ORDER BY s.option_value_id), '') AS key
    FROM product_variants pv LEFT JOIN variant_option_values s ON s.variant_id = pv.id
    WHERE pv.product_id = pid GROUP BY pv.id
  ) expected WHERE v.id = expected.id AND v.combination_key IS DISTINCT FROM expected.key;
END $$;

CREATE FUNCTION check_catalog_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM validate_catalog_product(OLD.product_id);
  ELSE PERFORM validate_catalog_product(NEW.product_id); END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION derive_variant_combination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT coalesce(string_agg(option_value_id::text, ',' ORDER BY option_value_id), '')
    INTO NEW.combination_key FROM variant_option_values WHERE variant_id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER variant_identity BEFORE INSERT OR UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION derive_variant_combination();

CREATE FUNCTION refresh_variant_combination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE product_variants SET combination_key = '' WHERE id = OLD.variant_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE product_variants SET combination_key = '' WHERE id = NEW.variant_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER selection_identity AFTER INSERT OR UPDATE OR DELETE ON variant_option_values
  FOR EACH ROW EXECUTE FUNCTION refresh_variant_combination();

CREATE FUNCTION lock_inventory_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE products SET updated_at = clock_timestamp() WHERE id =
      (SELECT product_id FROM product_variants WHERE id = OLD.variant_id);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE products SET updated_at = clock_timestamp() WHERE id =
      (SELECT product_id FROM product_variants WHERE id = NEW.variant_id);
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER inventory_product_lock BEFORE INSERT OR UPDATE OR DELETE ON inventory
  FOR EACH ROW EXECUTE FUNCTION lock_inventory_product();

DO $$
DECLARE tbl text; pid uuid;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['product_options', 'product_option_values', 'product_variants', 'variant_option_values', 'product_images'] LOOP
    EXECUTE format('CREATE TRIGGER catalog_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION lock_catalog_product()', tbl);
    EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_complete AFTER INSERT OR UPDATE OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_catalog_product()', tbl);
  END LOOP;
  FOR pid IN SELECT id FROM products LOOP
    PERFORM validate_catalog_product(pid);
  END LOOP;
END $$;

-- Force validation of migrated relationships and identities before dropping data.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
ALTER TABLE product_variants DROP COLUMN color, DROP COLUMN size;
