BEGIN;

CREATE TABLE IF NOT EXISTS mm_audience_sessions (
  session_id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL,
  current_path text NOT NULL,
  funnel_stage text NOT NULL CHECK (funnel_stage IN ('browse', 'cart', 'checkout')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mm_audience_sessions_active
  ON mm_audience_sessions(last_heartbeat);

CREATE TABLE IF NOT EXISTS mm_audience_events (
  event_id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('visit', 'page_view')),
  path text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mm_audience_events_time
  ON mm_audience_events(occurred_at);
CREATE INDEX IF NOT EXISTS mm_audience_events_path_time
  ON mm_audience_events(path, occurred_at);
CREATE INDEX IF NOT EXISTS mm_audience_events_visitor_time
  ON mm_audience_events(visitor_id, occurred_at);

COMMIT;
