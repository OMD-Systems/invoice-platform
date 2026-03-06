-- Migration 015: Security Fixes
-- 1. Remove duplicate trigger on email_requests (tr_email_request_created conflicts with tr_email_request_sync)
-- 2. Revoke anon access from reset_otp_rate_limit to prevent rate limit bypass
-- 3. Create audit_log table for PII access tracking

BEGIN;

-- 1. Drop duplicate trigger from migration-001 (tr_email_request_sync from seed.sql is the canonical one)
DROP TRIGGER IF EXISTS tr_email_request_created ON email_requests;

-- 2. Revoke anon execute on reset_otp_rate_limit (authenticated access retained)
REVOKE EXECUTE ON FUNCTION reset_otp_rate_limit(TEXT) FROM anon;

-- 3. Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  details JSONB,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name, action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_select ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_table TEXT,
  p_record_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO audit_log (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), p_action, p_table, p_record_id, p_details);
END;
$$;

REVOKE EXECUTE ON FUNCTION log_audit(TEXT, TEXT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION log_audit(TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMIT;
