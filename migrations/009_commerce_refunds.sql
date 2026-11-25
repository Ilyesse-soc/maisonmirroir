CREATE TABLE IF NOT EXISTS mm_commerce_refunds (
  refund_id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  order_id text NOT NULL REFERENCES mm_commerce_order_financials(order_id),
  paypal_capture_id text NOT NULL,
  paypal_refund_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL CHECK (status IN ('pending', 'unknown', 'completed', 'failed')),
  reason text NOT NULL,
  created_by text NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS mm_commerce_refunds_order_idx
  ON mm_commerce_refunds(order_id, created_at DESC);
