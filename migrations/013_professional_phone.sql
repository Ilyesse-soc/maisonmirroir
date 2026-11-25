BEGIN;

ALTER TABLE mm_brand_settings
  DROP CONSTRAINT IF EXISTS mm_brand_settings_key_check;

ALTER TABLE mm_brand_settings
  ADD CONSTRAINT mm_brand_settings_key_check CHECK (key IN (
    'brand_name',
    'contact_email',
    'professional_phone',
    'instagram_url',
    'tiktok_url',
    'welcome_copy',
    'confirmation_copy',
    'launch_copy',
    'campaign_footer'
  ));

INSERT INTO mm_brand_settings(key, value, updated_by)
VALUES ('professional_phone', '', 'system')
ON CONFLICT(key) DO NOTHING;

COMMIT;
