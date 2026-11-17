-- Keep existing categories intact. Ambiguous names must be resolved deliberately.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM categories GROUP BY lower(catalog_trim(name)) HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM categories WHERE length(catalog_trim(name)) = 0) THEN
    RAISE EXCEPTION 'Category migration: resolve empty or duplicate category names ignoring case and whitespace, then retry.';
  END IF;
END $$;
ALTER TABLE categories ADD CONSTRAINT categories_name_nonempty CHECK (length(catalog_trim(name)) > 0);
CREATE UNIQUE INDEX categories_normalized_name_idx ON categories(lower(catalog_trim(name)));
