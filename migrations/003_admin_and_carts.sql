BEGIN;
CREATE TABLE IF NOT EXISTS mm_admin_setup (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 token_hash text,expires_at timestamptz NOT NULL,claimed_at timestamptz
);
CREATE TABLE IF NOT EXISTS mm_carts (
 id uuid PRIMARY KEY,token_hash text UNIQUE NOT NULL,email text,
 items jsonb NOT NULL DEFAULT '[]',fingerprint text NOT NULL,
 consent boolean NOT NULL DEFAULT false,consent_at timestamptz,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','ordered','expired')),
 unsubscribe_token text UNIQUE NOT NULL,restore_token text UNIQUE NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mm_carts_due ON mm_carts(status,consent,updated_at);
CREATE TABLE IF NOT EXISTS mm_cart_reminders (
 id uuid PRIMARY KEY,cart_id uuid NOT NULL REFERENCES mm_carts(id) ON DELETE CASCADE,
 dedupe_key text UNIQUE NOT NULL,status text NOT NULL DEFAULT 'pending',
 attempts integer NOT NULL DEFAULT 0,next_attempt timestamptz NOT NULL DEFAULT now(),
 first_attempt_at timestamptz,provider_id text,updated_at timestamptz NOT NULL DEFAULT now(),error_code text
);
COMMIT;
