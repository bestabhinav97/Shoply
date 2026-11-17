CREATE TABLE categories (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL CHECK (length(trim(name)) > 0),
  slug varchar(100) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES categories(id),
  slug varchar(160) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name varchar(160) NOT NULL CHECK (length(trim(name)) > 0),
  description varchar(5000) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_status_idx ON products(category_id, status);
CREATE INDEX products_active_created_idx ON products(created_at DESC, id) WHERE status = 'active';

CREATE TABLE product_variants (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku varchar(100) NOT NULL UNIQUE CHECK (length(trim(sku)) > 0),
  color varchar(60) CHECK (length(trim(color)) > 0),
  size varchar(40) CHECK (length(trim(size)) > 0),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'SEK' CHECK (currency = 'SEK'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (product_id, color, size),
  UNIQUE (product_id, id)
);

CREATE TABLE inventory (
  variant_id uuid PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_images (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid,
  storage_key varchar(255) NOT NULL CHECK (storage_key ~ '^products/[a-z0-9-]+\.(jpg|webp|png)$'),
  alt_text varchar(300) NOT NULL CHECK (length(trim(alt_text)) > 0),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 10000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 10000),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, variant_id) REFERENCES product_variants(product_id, id),
  UNIQUE (product_id, position)
);
