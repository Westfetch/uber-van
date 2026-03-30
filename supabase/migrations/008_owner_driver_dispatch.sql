-- 008: Owner-driver tier + hybrid pool dispatch
-- Adds owner-driver fields, dispatch tracking, referral payouts, and dispatch queue.

-- ── 1. Extend drivers ──────────────────────────────────────────────────────
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_type TEXT NOT NULL DEFAULT 'pool'
  CHECK (driver_type IN ('owner', 'pool'));
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS priority_window_mins INT DEFAULT 30
  CHECK (priority_window_mins BETWEEN 5 AND 240);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS working_radius_miles INT DEFAULT NULL;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS crew_count INT NOT NULL DEFAULT 0;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS blocked_dates DATE[] NOT NULL DEFAULT '{}';

-- ── 2. Link owner-drivers to funnels ────────────────────────────────────────
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS owner_driver_id UUID REFERENCES drivers(id);

-- ── 3. Extend jobs for dispatch tracking ────────────────────────────────────
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatch_phase TEXT DEFAULT 'owner'
  CHECK (dispatch_phase IN ('owner', 'cascade', 'board', 'filled'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS owner_referral_driver_id UUID REFERENCES drivers(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS board_visible_at TIMESTAMPTZ;

-- ── 4. Extend payouts for referral tracking ─────────────────────────────────
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS referral_payout_id UUID REFERENCES payouts(id);

-- ── 5. Dispatch queue (cascade ordering) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_queue (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     UUID NOT NULL REFERENCES jobs(id),
  driver_id  UUID NOT NULL REFERENCES drivers(id),
  priority   INT NOT NULL,
  road_miles NUMERIC(8,1),
  status     TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'offered', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_queue_job ON dispatch_queue(job_id, priority);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_driver ON dispatch_queue(driver_id);

-- Enable RLS (service-role only, same as other tables)
ALTER TABLE dispatch_queue ENABLE ROW LEVEL SECURITY;

-- Enable realtime for dispatch_queue so pool drivers see board updates
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_queue;

-- ── 6. Index for board queries ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_dispatch_phase ON jobs(dispatch_phase);
