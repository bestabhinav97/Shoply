CREATE TABLE braintree_customers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  braintree_customer_id varchar(255) NOT NULL UNIQUE
    CHECK (length(btrim(braintree_customer_id)) > 0
      AND braintree_customer_id = btrim(braintree_customer_id)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
