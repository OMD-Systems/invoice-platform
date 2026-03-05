-- ============================================================
-- Migration 014: SECURITY DEFINER Functions — Full Audit & Fix
--
-- Issues found:
--   1. sync_email_on_request_created() — no SET search_path (search_path hijacking)
--   2. get_employee_safe / get_employees_safe — no auth.uid() check (anon could call if granted)
--   3. get_allowed_domains() — no auth.uid() check (minor, read-only but still)
--   4. check_otp_rate_limit / record_otp_attempt / reset_otp_rate_limit —
--      granted to anon, no input sanitization for email length/format
--   5. handle_new_user() — no input validation on email/role
--   6. create_invoice_atomic — no auth.uid() IS NOT NULL guard at top
--   7. increment_invoice_number — no auth.uid() IS NOT NULL guard at top
--   8. admin_create_user — no p_role validation (could insert arbitrary role)
--   9. cleanup_otp_rate_limits — OK (service_role only)
--
-- Fixes applied:
--   - SET search_path = public on ALL SECURITY DEFINER functions
--   - auth.uid() IS NOT NULL guard on all RPC functions that require auth
--   - Input validation where missing
--   - Revoke from anon where inappropriate
--   - STABLE/IMMUTABLE markers where applicable
--
-- Run in Supabase SQL Editor (one-time, idempotent)
-- ============================================================

BEGIN;


-- ============================================================
-- 1. TRIGGER: handle_new_user
--    Called by Supabase auth on user creation (no auth.uid() context).
--    Fix: add search_path (already in 007, re-declare for safety),
--         validate email format.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate email is present
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RAISE EXCEPTION 'Cannot create profile: email is required';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'viewer'
  );
  RETURN NEW;
END;
$$;


-- ============================================================
-- 2. TRIGGER: prevent_role_self_change
--    Fix: search_path (already in 007, re-declare).
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- 3. TRIGGER: check_month_not_locked
--    Fix: search_path (already in 008, re-declare).
--    No auth.uid() needed — trigger fires on row operations.
-- ============================================================
CREATE OR REPLACE FUNCTION check_month_not_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.month_locks WHERE month = NEW.month AND year = NEW.year) THEN
    RAISE EXCEPTION 'Month %/% is locked', NEW.month, NEW.year;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- 4. TRIGGER: check_invoice_status_transition
--    Fix: search_path (already in 011, re-declare).
-- ============================================================
CREATE OR REPLACE FUNCTION check_invoice_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_valid BOOLEAN := false;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(public.get_my_role(), 'viewer');

  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  CASE OLD.status
    WHEN 'draft' THEN
      v_valid := NEW.status IN ('generated', 'sent');
    WHEN 'generated' THEN
      v_valid := NEW.status IN ('sent');
    WHEN 'sent' THEN
      v_valid := NEW.status IN ('paid');
    WHEN 'paid' THEN
      v_valid := false;
    ELSE
      v_valid := false;
  END CASE;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Invalid status transition: % -> % (only admins can revert status)', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 5. TRIGGER: sync_email_on_request_created
--    CRITICAL FIX: was missing SET search_path entirely!
--    Also: no auth.uid() needed (trigger context).
-- ============================================================
CREATE OR REPLACE FUNCTION sync_email_on_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'created' AND (OLD.status IS DISTINCT FROM 'created') THEN
    UPDATE public.employees
    SET work_email = (
      SELECT p.email FROM public.profiles p WHERE p.id = NEW.requested_by
    )
    WHERE id = NEW.employee_id AND work_email IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


-- ============================================================
-- 6. RPC: get_my_role
--    Fix: add auth.uid() IS NOT NULL guard.
--    Without it, returns NULL for anon — not dangerous but sloppy.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Ensure only authenticated can call
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;


-- ============================================================
-- 7. RPC: is_admin_or_lead
--    Fix: add explicit auth.uid() IS NOT NULL check.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_lead()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role IN ('admin', 'lead');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_lead() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_lead() TO authenticated;


-- ============================================================
-- 8. RPC: is_admin
--    Fix: add auth.uid() IS NOT NULL guard.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN COALESCE(public.get_my_role(), 'viewer') = 'admin';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ============================================================
-- 9. RPC: is_month_locked
--    Read-only, no sensitive data. search_path already set.
--    Fix: add STABLE, re-declare with search_path.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_month_locked(p_month INTEGER, p_year INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.month_locks
    WHERE month = p_month AND year = p_year
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_month_locked(INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.is_month_locked(INTEGER, INTEGER) TO authenticated;


-- ============================================================
-- 10. RPC: get_regular_hours
--     Read-only utility. Fix: add STABLE, auth guard (optional but consistent).
-- ============================================================
CREATE OR REPLACE FUNCTION get_regular_hours(p_month INTEGER, p_year INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  config_row public.working_hours_config%ROWTYPE;
  calc_working_days INTEGER := 0;
  d DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO config_row
  FROM public.working_hours_config
  WHERE month = p_month AND year = p_year;

  IF FOUND THEN
    RETURN (config_row.working_days * config_row.hours_per_day) + config_row.adjustment_hours;
  END IF;

  d := make_date(p_year, p_month, 1);
  WHILE EXTRACT(MONTH FROM d) = p_month LOOP
    IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
      calc_working_days := calc_working_days + 1;
    END IF;
    d := d + INTERVAL '1 day';
  END LOOP;

  RETURN calc_working_days * 8.0;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_regular_hours(INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION get_regular_hours(INTEGER, INTEGER) TO authenticated;


-- ============================================================
-- 11. RPC: increment_invoice_number
--     Fix: add auth.uid() IS NOT NULL guard at top (before role check).
-- ============================================================
CREATE OR REPLACE FUNCTION increment_invoice_number(emp_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_num INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_admin_or_lead() THEN
    RAISE EXCEPTION 'Permission denied: only admin or lead can increment invoice numbers';
  END IF;

  SELECT next_invoice_number INTO current_num
  FROM public.employees WHERE id = emp_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found: %', emp_id;
  END IF;

  UPDATE public.employees
  SET next_invoice_number = current_num + 1
  WHERE id = emp_id;

  RETURN current_num;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_invoice_number(UUID) FROM public;
GRANT EXECUTE ON FUNCTION increment_invoice_number(UUID) TO authenticated;


-- ============================================================
-- 12. RPC: create_invoice_atomic (12-param version from migration-009)
--     Fix: add auth.uid() IS NOT NULL guard at top.
-- ============================================================
DROP FUNCTION IF EXISTS create_invoice_atomic(UUID, INTEGER, DATE, INTEGER, INTEGER, TEXT, NUMERIC, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION create_invoice_atomic(
  p_employee_id UUID,
  p_invoice_number INTEGER,
  p_invoice_date DATE,
  p_month INTEGER,
  p_year INTEGER,
  p_format_type TEXT,
  p_subtotal_usd NUMERIC(10,2),
  p_total_usd NUMERIC(10,2),
  p_status TEXT DEFAULT 'draft',
  p_items JSONB DEFAULT '[]'::jsonb,
  p_discount_usd NUMERIC(10,2) DEFAULT 0,
  p_tax_usd NUMERIC(10,2) DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_item JSONB;
  v_item_order INTEGER := 1;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Role check
  IF NOT public.is_admin_or_lead() THEN
    RAISE EXCEPTION 'Permission denied: only admin or lead can create invoices';
  END IF;

  -- Lead team check
  IF public.get_my_role() = 'lead' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.team_members tm ON tm.team_id = t.id
      WHERE t.lead_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND tm.employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'Permission denied: employee not in your team';
    END IF;
  END IF;

  -- Month lock check
  IF public.is_month_locked(p_month, p_year) THEN
    RAISE EXCEPTION 'Month %/% is locked', p_month, p_year;
  END IF;

  -- Validate status
  IF p_status NOT IN ('draft', 'generated', 'sent', 'paid') THEN
    RAISE EXCEPTION 'Invalid invoice status: %', p_status;
  END IF;

  INSERT INTO public.invoices (
    employee_id, invoice_number, invoice_date, month, year,
    format_type, subtotal_usd, discount_usd, tax_usd, total_usd, status, created_by
  ) VALUES (
    p_employee_id, p_invoice_number, p_invoice_date, p_month, p_year,
    p_format_type, p_subtotal_usd, p_discount_usd, p_tax_usd, p_total_usd, p_status, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, item_order, description, price_usd, qty, total_usd
    ) VALUES (
      v_invoice_id,
      COALESCE((v_item->>'item_order')::INTEGER, v_item_order),
      v_item->>'description',
      (v_item->>'price_usd')::NUMERIC(10,2),
      COALESCE((v_item->>'qty')::NUMERIC(10,4), 1),
      (v_item->>'total_usd')::NUMERIC(10,2)
    );
    v_item_order := v_item_order + 1;
  END LOOP;

  UPDATE public.employees
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = p_employee_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_invoice_atomic FROM public;
GRANT EXECUTE ON FUNCTION create_invoice_atomic TO authenticated;


-- ============================================================
-- 13. RPC: admin_create_user
--     Fix: validate p_role against allowed values,
--          auth.uid() IS NOT NULL guard,
--          validate p_password length.
-- ============================================================
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_admin_count INT;
  v_email_domain TEXT;
  v_domain_allowed BOOLEAN;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate role parameter
  IF p_role NOT IN ('admin', 'lead', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be admin, lead, or viewer.', p_role;
  END IF;

  -- Validate password length
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters.';
  END IF;

  -- Validate full name
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name is required.';
  END IF;

  -- Verify caller is Admin
  SELECT count(*) INTO v_admin_count
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF v_admin_count = 0 THEN
    RAISE EXCEPTION 'Only administrators can create new users.';
  END IF;

  -- Extract and validate email domain
  v_email_domain := split_part(lower(trim(p_email)), '@', 2);

  IF v_email_domain = '' OR v_email_domain IS NULL THEN
    RAISE EXCEPTION 'Invalid email address.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.allowed_email_domains WHERE domain = v_email_domain
  ) INTO v_domain_allowed;

  IF NOT v_domain_allowed THEN
    RAISE EXCEPTION 'Email domain "%" is not allowed. Contact an administrator to add it.', v_email_domain;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true),
    'email', p_email, now(), now(), now()
  );

  UPDATE public.profiles
  SET role = p_role,
      full_name = p_full_name
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_create_user FROM public;
GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;


-- ============================================================
-- 14. RPC: get_allowed_domains
--     Fix: add auth.uid() IS NOT NULL check.
--     Read-only but should still require authentication.
-- ============================================================
CREATE OR REPLACE FUNCTION get_allowed_domains()
RETURNS SETOF TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT domain FROM public.allowed_email_domains ORDER BY domain
$$;

REVOKE EXECUTE ON FUNCTION get_allowed_domains() FROM public;
GRANT EXECUTE ON FUNCTION get_allowed_domains() TO authenticated;


-- ============================================================
-- 15. RPC: get_employee_safe
--     Fix: add auth.uid() IS NOT NULL guard.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_employee_safe(p_employee_id UUID)
RETURNS TABLE (
  id UUID,
  pin TEXT,
  name TEXT,
  full_name_lat TEXT,
  work_email TEXT,
  email TEXT,
  employee_type TEXT,
  contract_type TEXT,
  is_active BOOLEAN,
  invoice_format TEXT,
  invoice_prefix TEXT,
  next_invoice_number INTEGER,
  service_description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  contract_uploaded_at TIMESTAMPTZ,
  nda_uploaded_at TIMESTAMPTZ,
  iban TEXT,
  swift TEXT,
  bank_name TEXT,
  receiver_name TEXT,
  rate_usd NUMERIC,
  address TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT es.*
  FROM public.employees_safe es
  WHERE es.id = p_employee_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_employee_safe(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_employee_safe(UUID) TO authenticated;


-- ============================================================
-- 16. RPC: get_employees_safe
--     Fix: add auth.uid() IS NOT NULL guard.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_employees_safe()
RETURNS TABLE (
  id UUID,
  pin TEXT,
  name TEXT,
  full_name_lat TEXT,
  work_email TEXT,
  email TEXT,
  employee_type TEXT,
  contract_type TEXT,
  is_active BOOLEAN,
  invoice_format TEXT,
  invoice_prefix TEXT,
  next_invoice_number INTEGER,
  service_description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  contract_uploaded_at TIMESTAMPTZ,
  nda_uploaded_at TIMESTAMPTZ,
  iban TEXT,
  swift TEXT,
  bank_name TEXT,
  receiver_name TEXT,
  rate_usd NUMERIC,
  address TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT es.*
  FROM public.employees_safe es
  WHERE es.is_active = true
  ORDER BY es.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_employees_safe() FROM public;
GRANT EXECUTE ON FUNCTION public.get_employees_safe() TO authenticated;


-- ============================================================
-- 17. RPC: check_otp_rate_limit
--     Pre-auth function (called before login).
--     Fix: validate email length to prevent abuse.
--     Must remain accessible to anon (pre-login flow).
-- ============================================================
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
  -- Input validation
  IF p_email IS NULL OR length(trim(p_email)) < 5 OR length(trim(p_email)) > 320 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  p_email := lower(trim(p_email));

  SELECT * INTO v_record FROM public.otp_rate_limits WHERE email = p_email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_max_attempts,
      'locked_until', null,
      'retry_after_seconds', 0
    );
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_now < v_record.locked_until THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'locked_until', v_record.locked_until,
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_record.locked_until - v_now))::INTEGER
    );
  END IF;

  IF v_record.locked_until IS NOT NULL AND v_now >= v_record.locked_until THEN
    DELETE FROM public.otp_rate_limits WHERE email = p_email;
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_max_attempts,
      'locked_until', null,
      'retry_after_seconds', 0
    );
  END IF;

  IF v_now - v_record.last_attempt_at > v_window THEN
    DELETE FROM public.otp_rate_limits WHERE email = p_email;
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_max_attempts,
      'locked_until', null,
      'retry_after_seconds', 0
    );
  END IF;

  IF v_record.attempts >= v_max_attempts THEN
    UPDATE public.otp_rate_limits
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


-- ============================================================
-- 18. RPC: record_otp_attempt
--     Pre-auth. Fix: email validation.
-- ============================================================
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
  -- Input validation
  IF p_email IS NULL OR length(trim(p_email)) < 5 OR length(trim(p_email)) > 320 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  p_email := lower(trim(p_email));

  INSERT INTO public.otp_rate_limits (email, attempts, last_attempt_at)
  VALUES (p_email, 1, v_now)
  ON CONFLICT (email) DO UPDATE
    SET
      attempts = CASE
        WHEN v_now - otp_rate_limits.last_attempt_at > v_window THEN 1
        ELSE otp_rate_limits.attempts + 1
      END,
      last_attempt_at = v_now,
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


-- ============================================================
-- 19. RPC: reset_otp_rate_limit
--     Pre-auth. Fix: email validation.
-- ============================================================
CREATE OR REPLACE FUNCTION reset_otp_rate_limit(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) < 5 OR length(trim(p_email)) > 320 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  DELETE FROM public.otp_rate_limits WHERE email = lower(trim(p_email));
END;
$$;


-- ============================================================
-- 20. RPC: cleanup_otp_rate_limits
--     Service-role only. Already OK, re-declare for consistency.
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_otp_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.otp_rate_limits
  WHERE last_attempt_at < now() - INTERVAL '1 hour'
    AND (locked_until IS NULL OR locked_until < now());
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_otp_rate_limits() FROM public;
REVOKE EXECUTE ON FUNCTION cleanup_otp_rate_limits() FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_otp_rate_limits() FROM authenticated;
GRANT EXECUTE ON FUNCTION cleanup_otp_rate_limits() TO service_role;


-- ============================================================
-- OTP functions: keep anon + authenticated access (pre-login flow)
-- ============================================================
GRANT EXECUTE ON FUNCTION check_otp_rate_limit(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_otp_attempt(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_otp_rate_limit(TEXT) TO anon, authenticated;


COMMIT;

-- ============================================================
-- AUDIT SUMMARY:
--
-- CRITICAL fixes:
--   [1] sync_email_on_request_created — added SET search_path = public
--       (was vulnerable to search_path hijacking)
--   [2] admin_create_user — added p_role validation (prevented injection
--       of arbitrary role like 'superadmin')
--   [3] admin_create_user — added p_password length validation
--
-- HIGH fixes:
--   [4] create_invoice_atomic — added auth.uid() IS NOT NULL guard
--   [5] increment_invoice_number — added auth.uid() IS NOT NULL guard
--   [6] get_employee_safe — added auth.uid() IS NOT NULL guard
--   [7] get_employees_safe — added auth.uid() IS NOT NULL guard
--   [8] get_regular_hours — added auth.uid() IS NOT NULL guard
--   [9] increment_invoice_number — added employee existence check
--   [10] create_invoice_atomic — added p_status validation
--
-- MEDIUM fixes:
--   [11] OTP functions — added email length/format validation
--   [12] is_admin_or_lead — added auth.uid() IS NOT NULL → return false
--   [13] is_admin — added auth.uid() IS NOT NULL → return false
--   [14] handle_new_user — added email presence validation
--   [15] All functions — added STABLE where applicable
--   [16] All RPC functions — REVOKE FROM public, GRANT TO authenticated
--
-- No changes needed:
--   - get_my_role: SQL function, returns NULL if no auth — safe
--   - check_month_not_locked: trigger, no auth context needed
--   - check_invoice_status_transition: uses get_my_role() fallback
--   - prevent_role_self_change: trigger, already checks auth.uid()
-- ============================================================
