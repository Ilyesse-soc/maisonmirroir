CREATE TABLE IF NOT EXISTS mm_shipping_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings jsonb NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
