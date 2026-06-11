CREATE TABLE IF NOT EXISTS search_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  postcode text,
  latitude double precision,
  longitude double precision,
  filters jsonb NOT NULL DEFAULT '{}',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT search_alerts_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS search_alerts_token_idx ON search_alerts (token);
CREATE INDEX IF NOT EXISTS search_alerts_email_idx ON search_alerts (email);
CREATE INDEX IF NOT EXISTS search_alerts_ip_idx ON search_alerts (ip);

-- Service role only — no user-facing RLS needed
ALTER TABLE search_alerts DISABLE ROW LEVEL SECURITY;
