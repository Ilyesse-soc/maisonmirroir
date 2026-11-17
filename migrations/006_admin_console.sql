BEGIN;
ALTER TABLE mm_campaigns
  ADD COLUMN IF NOT EXISTS preheader text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS mm_marketing_events (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('campaign','launch','content','other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  notes text NOT NULL DEFAULT '',
  campaign_id uuid REFERENCES mm_campaigns(id) ON DELETE SET NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mm_marketing_events_starts ON mm_marketing_events(starts_at);

CREATE TABLE IF NOT EXISTS mm_brand_settings (
  key text PRIMARY KEY CHECK (key IN (
    'brand_name','contact_email','instagram_url','tiktok_url',
    'welcome_copy','confirmation_copy','launch_copy','campaign_footer'
  )),
  value text NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mm_brand_settings(key,value,updated_by) VALUES
  ('brand_name','Maison Miroir','system'),
  ('contact_email','contact@maison-miroir.fr','system'),
  ('instagram_url','','system'),
  ('tiktok_url','','system'),
  ('welcome_copy','Nous sommes ravies de vous compter parmi les premières à rejoindre notre communauté.

Une nouvelle vision de la mode arrive bientôt, pensée pour les femmes qui souhaitent exprimer leur identité avec élégance et pudeur.

Vous serez informée en avant-première du lancement de notre première collection.','system'),
  ('confirmation_copy','Merci pour votre intérêt pour Maison Miroir.

Pour finaliser votre inscription et commencer à recevoir nos actualités, veuillez confirmer votre adresse e-mail.','system'),
  ('launch_copy','Notre première collection est désormais disponible.

Découvrez des pièces raffinées, modernes et pudiques, pensées pour vous accompagner avec élégance et intemporalité.','system'),
  ('campaign_footer','','system')
ON CONFLICT(key) DO NOTHING;
COMMIT;
