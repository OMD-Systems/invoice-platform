-- ============================================================
-- Migration 007: RPC & Function Security Hardening
-- Fixes: CRITICAL/HIGH vulnerabilities in SECURITY DEFINER functions
-- Run in Supabase SQL Editor (one-time, idempotent)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. SECURITY DEFINER functions: add SET search_path = public
--    Prevents search_path hijacking attacks
-- ────────────────────────────────────────────────────────────

-- 1a. handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1b. prevent_role_self_change
CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1c. is_month_locked
CREATE OR REPLACE FUNCTION public.is_month_locked(p_month INTEGER, p_year INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM month_locks
    WHERE month = p_month AND year = p_year
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1d. get_regular_hours
CREATE OR REPLACE FUNCTION get_regular_hours(p_month INTEGER, p_year INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  config_row working_hours_config%ROWTYPE;
  calc_working_days INTEGER := 0;
  d DATE;
BEGIN
  SELECT * INTO config_row
  FROM working_hours_config
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1e. get_my_role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 1f. is_admin_or_lead
CREATE OR REPLACE FUNCTION public.is_admin_or_lead()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role IN ('admin', 'lead');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ────────────────────────────────────────────────────────────
-- 2. create_invoice_atomic: add role + team + month-lock checks
-- ────────────────────────────────────────────────────────────
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
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_item JSONB;
  v_item_order INTEGER := 1;
BEGIN
  -- Role check
  IF NOT public.is_admin_or_lead() THEN
    RAISE EXCEPTION 'Permission denied: only admin or lead can create invoices';
  END IF;

  -- Lead team check
  IF public.get_my_role() = 'lead' THEN
    IF NOT EXISTS (
      SELECT 1 FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
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

  -- Insert the invoice
  INSERT INTO invoices (
    employee_id, invoice_number, invoice_date, month, year,
    format_type, subtotal_usd, total_usd, status, created_by
  ) VALUES (
    p_employee_id, p_invoice_number, p_invoice_date, p_month, p_year,
    p_format_type, p_subtotal_usd, p_total_usd, p_status, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  -- Insert all line items from the JSONB array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, item_order, description, price_usd, qty, total_usd
    ) VALUES (
      v_invoice_id,
      COALESCE((v_item->>'item_order')::INTEGER, v_item_order),
      v_item->>'description',
      (v_item->>'price_usd')::NUMERIC(10,2),
      COALESCE((v_item->>'qty')::INTEGER, 1),
      (v_item->>'total_usd')::NUMERIC(10,2)
    );
    v_item_order := v_item_order + 1;
  END LOOP;

  -- Atomically increment the employee's invoice number
  UPDATE employees
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = p_employee_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION create_invoice_atomic TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 3. increment_invoice_number: restrict access + add role check
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_invoice_number(emp_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_num INTEGER;
BEGIN
  -- Role check: only admin or lead
  IF NOT public.is_admin_or_lead() THEN
    RAISE EXCEPTION 'Permission denied: only admin or lead can increment invoice numbers';
  END IF;

  SELECT next_invoice_number INTO current_num
  FROM employees WHERE id = emp_id FOR UPDATE;

  UPDATE employees
  SET next_invoice_number = current_num + 1
  WHERE id = emp_id;

  RETURN current_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke from public, grant only to authenticated
REVOKE EXECUTE ON FUNCTION increment_invoice_number(UUID) FROM public;
GRANT EXECUTE ON FUNCTION increment_invoice_number(UUID) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 4. invoices_delete_policy: replace permissive policy with
--    separate admin (any) and lead (team-scoped) policies
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_lead" ON public.invoices;

-- Admin can delete any invoice
CREATE POLICY "invoices_delete_admin" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'admin'
  );

-- Lead can delete only invoices for employees in their team
CREATE POLICY "invoices_delete_lead" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'lead'
    AND employee_id IN (
      SELECT tm.employee_id FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE t.lead_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );


-- ────────────────────────────────────────────────────────────
-- 5. profiles_update_own: add WITH CHECK to prevent role
--    self-change via RLS (defense in depth)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));


-- ────────────────────────────────────────────────────────────
-- Done! All CRITICAL/HIGH SQL security issues patched.
-- ────────────────────────────────────────────────────────────
