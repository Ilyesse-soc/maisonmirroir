ALTER TABLE mm_commerce_order_financials
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparation_deadline date,
  ADD COLUMN IF NOT EXISTS cgv_version text,
  ADD COLUMN IF NOT EXISTS cgv_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawal_requested_at timestamptz;

CREATE TABLE IF NOT EXISTS mm_commerce_withdrawal_requests (
  order_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mm_commerce_email_events
  DROP CONSTRAINT IF EXISTS mm_commerce_email_events_event_type_check;

ALTER TABLE mm_commerce_email_events
  ADD CONSTRAINT mm_commerce_email_events_event_type_check
  CHECK (event_type IN (
    'order_confirmation',
    'new_order_admin',
    'shipment_confirmation',
    'relay_available',
    'cancellation',
    'refund',
    'withdrawal_confirmation'
  ));
