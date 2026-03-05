-- Migration 013: Server-side OTP rate limiting
-- Prevents brute-force OTP requests at the database level
-- Limit: 5 attempts per 15 minutes, then 30-minute lockout

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_rate_limits (
  email       TEXT PRIMARY KEY,
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until    TIMESTAMPTZ
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_last_attempt
  ON otp_rate_limits (last_attempt_at);

-- RLS: no direct access from client, only via RPC
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no client access (service_role only + RPC with SECURITY DEFINER)

-- ── RPC: check_otp_rate_limit ────────────────────────────────
-- Returns JSON: { "allowed": bool, "remaining": int, "locked_until": timestamp|null, "retry_after_seconds": int }
CREATE OR REPLACE FUNCTION check_otp_rate_limit(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record otp_rate_limits%ROWTYPE;
  v_max_attempts INTEGER := 5;
  v_window INTERVAL := '15 minutes';
  v_lockout INTERVAL := '30 minutes';
  v_now TIMESTAMPTZ := now();
BEGIN
  p_email := lower(trim(p_email));

  SELECT * INTO v_record FROM otp_rate_limits WHERE email = p_email;

  -- No record = first attempt, allowed
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_max_attempts,
      'locked_until', null,
      'retry_after_seconds', 0
    );
  END IF;

  -- Currently locked out?
  IF v_record.locked_until IS NOT NULL AND v_now < v_record.locked_until THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'locked_until', v_record.locked_until,
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_record.locked_until - v_now))::INTEGER
    );
  END IF;

  -- Lock expired — reset
  IF v_record.locked_until IS NOT NULL AND v_now >= v_record.locked_until THEN
    DELETE FROM otp_rate_limits WHERE email = p_email;
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_max_attempts,
      'locked_until', null,
      'retry_after_seconds', 0
    );
  END IF;

  -- Window expired — reset
  IF v_now - v_record.last_attempt_at > v_window THEN
    DELETE FROM otp_rate_limits WHERE email = p_email;
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_max_attempts,
      'locked_until', null,
      'retry_after_seconds', 0
    );
  END IF;

  -- Within window, check attempts
  IF v_record.attempts >= v_max_attempts THEN
    -- Should already be locked, but enforce
    UPDATE otp_rate_limits
      SET locked_until = v_now + v_lockout
      WHERE email = p_email AND locked_until IS NULL;
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'locked_until', v_now + v_lockout,
      'retry_after_seconds', EXTRACT(EPOCH FROM v_lockout)::INTEGER
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_max_attempts - v_record.attempts,
    'locked_until', null,
    'retry_after_seconds', 0
  );
END;
$$;

-- ── RPC: record_otp_attempt ──────────────────────────────────
-- Call AFTER sending OTP. Increments counter, sets lockout if limit reached.
CREATE OR REPLACE FUNCTION record_otp_attempt(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts INTEGER := 5;
  v_window INTERVAL := '15 minutes';
  v_lockout INTERVAL := '30 minutes';
  v_now TIMESTAMPTZ := now();
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
BEGIN
  p_email := lower(trim(p_email));

  INSERT INTO otp_rate_limits (email, attempts, last_attempt_at)
  VALUES (p_email, 1, v_now)
  ON CONFLICT (email) DO UPDATE
    SET
      -- Reset counter if window expired, otherwise increment
      attempts = CASE
        WHEN v_now - otp_rate_limits.last_attempt_at > v_window THEN 1
        ELSE otp_rate_limits.attempts + 1
      END,
      last_attempt_at = v_now,
      -- Set lockout if hitting the limit
      locked_until = CASE
        WHEN v_now - otp_rate_limits.last_attempt_at > v_window THEN NULL
        WHEN otp_rate_limits.attempts + 1 >= v_max_attempts THEN v_now + v_lockout
        ELSE otp_rate_limits.locked_until
      END
  RETURNING attempts, locked_until INTO v_attempts, v_locked_until;

  RETURN jsonb_build_object(
    'attempts', v_attempts,
    'remaining', GREATEST(0, v_max_attempts - v_attempts),
    'locked_until', v_locked_until
  );
END;
$$;

-- ── RPC: reset_otp_rate_limit ────────────────────────────────
-- Call on successful OTP verification to clear the counter
CREATE OR REPLACE FUNCTION reset_otp_rate_limit(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM otp_rate_limits WHERE email = lower(trim(p_email));
END;
$$;

-- ── Cleanup: remove stale records ────────────────────────────
-- Records older than 1 hour are safe to remove (lockout is 30 min max)
CREATE OR REPLACE FUNCTION cleanup_otp_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM otp_rate_limits
  WHERE last_attempt_at < now() - INTERVAL '1 hour'
    AND (locked_until IS NULL OR locked_until < now());
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ── Cron job for auto-cleanup (requires pg_cron extension) ───
-- Uncomment if pg_cron is enabled in your Supabase project:
-- SELECT cron.schedule(
--   'cleanup-otp-rate-limits',
--   '0 * * * *',  -- every hour
--   $$SELECT cleanup_otp_rate_limits()$$
-- );

-- ── Grant execute to authenticated & anon ────────────────────
GRANT EXECUTE ON FUNCTION check_otp_rate_limit(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_otp_attempt(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_otp_rate_limit(TEXT) TO anon, authenticated;
-- cleanup only for service_role (cron or admin)
GRANT EXECUTE ON FUNCTION cleanup_otp_rate_limits() TO service_role;
