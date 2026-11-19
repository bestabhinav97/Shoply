CREATE TABLE addresses (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name varchar(200) NOT NULL CHECK (length(btrim(recipient_name)) > 0),
  phone_number varchar(16) NOT NULL CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  address_line1 varchar(200) NOT NULL CHECK (length(btrim(address_line1)) > 0),
  address_line2 varchar(200) NOT NULL DEFAULT '',
  postal_code varchar(5) NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  city varchar(100) NOT NULL CHECK (length(btrim(city)) > 0),
  country_code varchar(2) NOT NULL DEFAULT 'SE' CHECK (country_code = 'SE'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Also indexes user_id for address-book reads and supports the ownership FKs below.
  UNIQUE (user_id, id)
);

CREATE TABLE user_address_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_address_id uuid,
  selected_address_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Including user_id prevents referencing an address owned by another customer.
  FOREIGN KEY (user_id, default_address_id) REFERENCES addresses(user_id, id)
    ON DELETE SET NULL (default_address_id),
  FOREIGN KEY (user_id, selected_address_id) REFERENCES addresses(user_id, id)
    ON DELETE SET NULL (selected_address_id)
);
