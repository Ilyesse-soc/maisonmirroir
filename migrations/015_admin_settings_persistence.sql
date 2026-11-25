BEGIN;

ALTER TABLE mm_brand_settings
  DROP CONSTRAINT IF EXISTS mm_brand_settings_key_check;

ALTER TABLE mm_brand_settings
  ADD CONSTRAINT mm_brand_settings_key_check CHECK (key IN (
    'brand_name', 'contact_email', 'professional_phone',
    'legal_seller_name', 'mediator_name', 'mediator_address',
    'mediator_url', 'legal_terms_confirmed',
    'instagram_url', 'tiktok_url', 'welcome_copy',
    'confirmation_copy', 'launch_copy', 'campaign_footer'
  ));

-- Historical records can contain only edited fields. Their contextual defaults
-- must be explicit before confirmations can round-trip through the parser.
-- Existing values and every confirmation flag are preserved.
UPDATE mm_shipping_settings
SET settings = jsonb_build_object('serviceCode', '24R/MED', 'collectionMode', 'REL') || settings,
    updated_at = now()
WHERE id = 1 AND (NOT (settings ? 'serviceCode') OR NOT (settings ? 'collectionMode'));

COMMIT;
