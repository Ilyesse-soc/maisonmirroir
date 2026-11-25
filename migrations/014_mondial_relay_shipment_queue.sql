CREATE TABLE IF NOT EXISTS mm_mondial_relay_shipment_jobs (
  order_id text PRIMARY KEY REFERENCES mm_orders(order_id),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'unknown')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  leased_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mm_mondial_relay_shipment_jobs_ready_idx
  ON mm_mondial_relay_shipment_jobs(next_attempt_at, created_at)
  WHERE status IN ('queued', 'processing');

CREATE TABLE IF NOT EXISTS mm_mondial_relay_shipment_labels (
  order_id text PRIMARY KEY REFERENCES mm_orders(order_id),
  pdf bytea NOT NULL CHECK (octet_length(pdf) BETWEEN 8 AND 10000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mm_commerce_order_financials
  DROP CONSTRAINT IF EXISTS mm_commerce_order_financials_shipment_status_check;

ALTER TABLE mm_commerce_order_financials
  ADD CONSTRAINT mm_commerce_order_financials_shipment_status_check
  CHECK (shipment_status IN (
    'unfulfilled', 'preparing', 'ready', 'shipped', 'delivered',
    'returned', 'cancelled'
  ));
