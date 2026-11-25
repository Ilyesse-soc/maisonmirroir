CREATE TABLE IF NOT EXISTS mm_commerce_products (
  product_id text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  initial_quantity integer NOT NULL CHECK (initial_quantity >= 0),
  quantity_on_hand integer NOT NULL CHECK (quantity_on_hand >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  sold_quantity integer NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reserved_quantity <= quantity_on_hand)
);

INSERT INTO mm_commerce_products
  (product_id, name, color, price_cents, initial_quantity, quantity_on_hand)
VALUES
  ('modest-era', 'Modest Era', 'Noir', 2990, 44, 44),
  ('paradise-way', 'Paradise Way', 'Marron', 2990, 44, 44)
ON CONFLICT (product_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS mm_promotions (
  code text PRIMARY KEY,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redeemed_count integer NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  product_ids text[] NOT NULL DEFAULT '{}',
  minimum_order_cents integer NOT NULL DEFAULT 0 CHECK (minimum_order_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_redemptions IS NULL OR redeemed_count + reserved_count <= max_redemptions)
);

INSERT INTO mm_promotions
  (code, discount_type, discount_value, max_redemptions, product_ids, active)
VALUES ('FIRSTPRINCESS1', 'percent', 10, 20, ARRAY['modest-era', 'paradise-way'], true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS mm_commerce_reservations (
  reservation_id text PRIMARY KEY,
  paypal_order_id text UNIQUE,
  status text NOT NULL CHECK (status IN ('reserved', 'completed', 'released', 'expired', 'payment_failed')),
  items jsonb NOT NULL,
  order_snapshot jsonb NOT NULL,
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  promotion_code text REFERENCES mm_promotions(code),
  discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  shipping_cents integer NOT NULL CHECK (shipping_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  expires_at timestamptz NOT NULL,
  order_id text UNIQUE,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mm_commerce_reservations_expiry_idx
  ON mm_commerce_reservations(expires_at)
  WHERE status = 'reserved';

CREATE TABLE IF NOT EXISTS mm_promotion_redemptions (
  order_id text PRIMARY KEY,
  paypal_order_id text NOT NULL UNIQUE,
  code text NOT NULL REFERENCES mm_promotions(code),
  discount_cents integer NOT NULL CHECK (discount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mm_stock_movements (
  movement_id bigserial PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  product_id text NOT NULL REFERENCES mm_commerce_products(product_id),
  movement_type text NOT NULL CHECK (movement_type IN ('initial', 'sale', 'restock', 'correction', 'return')),
  quantity_delta integer NOT NULL,
  quantity_before integer NOT NULL CHECK (quantity_before >= 0),
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  reason text NOT NULL,
  order_id text,
  admin_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mm_stock_movements
  (idempotency_key, product_id, movement_type, quantity_delta, quantity_before,
   quantity_after, reason)
SELECT 'initial:' || product_id, product_id, 'initial', initial_quantity, 0,
       initial_quantity, 'Stock initial approuvé pour le lancement'
FROM mm_commerce_products
WHERE product_id IN ('modest-era', 'paradise-way')
ON CONFLICT (idempotency_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS mm_commerce_order_financials (
  order_id text PRIMARY KEY,
  paypal_order_id text NOT NULL UNIQUE,
  paypal_capture_id text,
  payment_status text NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  shipment_status text NOT NULL DEFAULT 'unfulfilled'
    CHECK (shipment_status IN ('unfulfilled', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled')),
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  promotion_code text REFERENCES mm_promotions(code),
  discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  shipping_cents integer NOT NULL CHECK (shipping_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  refunded_cents integer NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  internal_notes text NOT NULL DEFAULT '',
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mm_commerce_email_events (
  event_key text PRIMARY KEY,
  order_id text NOT NULL,
  recipient text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('order_confirmation', 'new_order_admin', 'shipment_confirmation', 'cancellation', 'refund')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mm_commerce_email_events_retry_idx
  ON mm_commerce_email_events(status, updated_at)
  WHERE status IN ('pending', 'failed');
