ALTER TABLE mm_commerce_order_financials
  ADD COLUMN IF NOT EXISTS return_status text NOT NULL DEFAULT 'none'
    CHECK (return_status IN (
      'none',
      'requested',
      'accepted',
      'awaiting_receipt',
      'received',
      'refund_in_progress',
      'refunded'
    ));

ALTER TABLE mm_commerce_order_financials
  ADD COLUMN IF NOT EXISTS return_updated_at timestamptz;
