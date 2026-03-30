-- 009: Rate limiting table for auth endpoints
-- Tracks failed login attempts by IP + scope. Rows auto-expire via cron cleanup.

CREATE TABLE IF NOT EXISTS rate_limits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         TEXT NOT NULL,
  scope      TEXT NOT NULL DEFAULT 'auth',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON rate_limits (ip, scope, created_at);

-- Enable RLS (service-role only)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
