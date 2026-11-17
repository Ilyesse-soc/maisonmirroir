BEGIN;
CREATE TABLE IF NOT EXISTS mm_subscribers (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','active','unsubscribed','suppressed')),
 created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz,
 consent_at timestamptz NOT NULL DEFAULT now(), consent_version text NOT NULL,
 consent_source text NOT NULL DEFAULT 'launch-form', consent_ip_hash text NOT NULL,
 confirmation_hash text, confirmation_expires timestamptz,
 unsubscribe_token text NOT NULL, last_confirmation_at timestamptz,
 unsubscribed_at timestamptz
);
CREATE TABLE IF NOT EXISTS mm_campaigns (
 id uuid PRIMARY KEY, title text NOT NULL, subject text NOT NULL, body text NOT NULL,
 image_url text, link_url text, promo_code text, ends_at timestamptz,
 products jsonb NOT NULL DEFAULT '[]', publication_key text UNIQUE,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','sending','completed')),
 scheduled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz
);
CREATE TABLE IF NOT EXISTS mm_jobs (
 id uuid PRIMARY KEY, subscriber_id uuid NOT NULL REFERENCES mm_subscribers(id) ON DELETE CASCADE,
 campaign_id uuid REFERENCES mm_campaigns(id), kind text NOT NULL CHECK(kind IN ('confirmation','campaign')),
 dedupe_key text UNIQUE NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
 next_attempt timestamptz NOT NULL DEFAULT now(), leased_at timestamptz, first_attempt_at timestamptz,
 provider_id text, error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mm_jobs_pending ON mm_jobs(status,next_attempt);
CREATE TABLE IF NOT EXISTS mm_email_events (event_id text PRIMARY KEY, job_id uuid REFERENCES mm_jobs(id) ON DELETE CASCADE, event_type text NOT NULL, received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mm_rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
COMMIT;
