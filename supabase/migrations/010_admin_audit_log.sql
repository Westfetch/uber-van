-- 010: Admin audit log — tracks all admin actions for forensics
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID NOT NULL REFERENCES admins(id),
  action     TEXT NOT NULL,
  method     TEXT NOT NULL,
  payload    JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log (action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
