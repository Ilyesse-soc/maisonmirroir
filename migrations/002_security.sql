BEGIN;
ALTER TABLE mm_jobs ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz;
ALTER TABLE mm_jobs ADD COLUMN IF NOT EXISTS lease_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS mm_jobs_provider ON mm_jobs(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mm_jobs_campaign ON mm_jobs(campaign_id,status);
CREATE INDEX IF NOT EXISTS mm_subscribers_status ON mm_subscribers(status,consent_at);
CREATE TABLE IF NOT EXISTS mm_consent_events (
 id uuid PRIMARY KEY, subscriber_id uuid NOT NULL REFERENCES mm_subscribers(id) ON DELETE CASCADE,
 event text NOT NULL CHECK(event IN ('requested','confirmed','unsubscribed')),
 consent_version text NOT NULL, ip_hash text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mm_worker_runs (
 id uuid PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 processed integer NOT NULL DEFAULT 0, status text NOT NULL CHECK(status IN ('running','completed','failed'))
);
CREATE TABLE IF NOT EXISTS mm_admin_audit (
 id uuid PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, target_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mm_orders (
 order_id text PRIMARY KEY, paypal_order_id text UNIQUE, record jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mm_webhook_receipts (
 event_id text PRIMARY KEY, provider_id text NOT NULL, event_type text NOT NULL,
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
