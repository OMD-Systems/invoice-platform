-- ============================================================
-- Migration 019: Viewer Self-Service
--
-- Enables viewers to:
--   - See their own financial data (iban, swift, etc.)
--   - Edit their own profile (address, phone, banking)
--   - Create/edit/delete their own invoices (draft/generated only)
--   - Suggest hours per project
--   - Manage expenses on their own draft/generated invoices
--
-- Depends on: migration-013 (employees_safe), migration-014 (security definer audit)
-- Run in Supabase SQL Editor (one-time, idempotent)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Helper: get_my_employee_id()
--    Returns employees.id linked to the current auth user's email.
--    Central lookup used by all viewer RPC functions.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.employees
  WHERE work_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_employee_id() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_employee_id() TO authenticated;


-- ============================================================
-- 2. Table: timesheet_suggestions
--    Viewers suggest hours per project; admin/lead accept/reject.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timesheet_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  suggested_hours NUMERIC(6,2) NOT NULL CHECK (suggested_hours >= 0),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, project_id, month, year)
);

-- RLS
ALTER TABLE public.timesheet_suggestions ENABLE ROW LEVEL SECURITY;

-- SELECT: own (via email match) + admin/lead
DROP POLICY IF EXISTS "ts_suggestions_select" ON public.timesheet_suggestions;
CREATE POLICY "ts_suggestions_select" ON public.timesheet_suggestions
  FOR SELECT TO authenticated
  USING (
    employee_id = public.get_my_employee_id()
    OR public.is_admin_or_lead()
  );

-- INSERT: only own employee_id
DROP POLICY IF EXISTS "ts_suggestions_insert" ON public.timesheet_suggestions;
CREATE POLICY "ts_suggestions_insert" ON public.timesheet_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.get_my_employee_id()
  );

-- UPDATE: admin/lead only (accept/reject)
DROP POLICY IF EXISTS "ts_suggestions_update" ON public.timesheet_suggestions;
CREATE POLICY "ts_suggestions_update" ON public.timesheet_suggestions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_lead()
  );

-- DELETE: own pending + admin any
DROP POLICY IF EXISTS "ts_suggestions_delete" ON public.timesheet_suggestions;
CREATE POLICY "ts_suggestions_delete" ON public.timesheet_suggestions
  FOR DELETE TO authenticated
  USING (
    (employee_id = public.get_my_employee_id() AND status = 'pending')
    OR public.is_admin_or_lead()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timesheet_suggestions TO authenticated;


-- ============================================================
-- 3. Update employees_safe VIEW
--    Reveal sensitive fields for own profile (via get_my_employee_id())
-- ============================================================
DROP VIEW IF EXISTS public.employees_safe;

CREATE VIEW public.employees_safe AS
SELECT
  id,
  pin,
  name,
  full_name_lat,
  work_email,
  email,
  employee_type,
  contract_type,
  is_active,
  invoice_format,
  invoice_prefix,
  next_invoice_number,
  service_description,
  avatar_url,
  created_at,
  updated_at,
  contract_uploaded_at,
  nda_uploaded_at,

  -- Sensitive fields: visible to admin/lead OR own profile
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN iban ELSE NULL END AS iban,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN swift ELSE NULL END AS swift,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN bank_name ELSE NULL END AS bank_name,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN receiver_name ELSE NULL END AS receiver_name,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN rate_usd ELSE NULL END AS rate_usd,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN address ELSE NULL END AS address,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN phone ELSE NULL END AS phone

FROM public.employees;

GRANT SELECT ON public.employees_safe TO authenticated;

COMMENT ON VIEW public.employees_safe IS
  'Secure view over employees. Masks sensitive fields for viewer role, except for own profile.';


-- ============================================================
-- 4. Re-create get_employee_safe / get_employees_safe
--    (They SELECT from employees_safe, which we just recreated)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_employee_safe(p_employee_id UUID)
RETURNS TABLE (
  id UUID, pin TEXT, name TEXT, full_name_lat TEXT, work_email TEXT, email TEXT,
  employee_type TEXT, contract_type TEXT, is_active BOOLEAN,
  invoice_format TEXT, invoice_prefix TEXT, next_invoice_number INTEGER,
  service_description TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  contract_uploaded_at TIMESTAMPTZ, nda_uploaded_at TIMESTAMPTZ,
  iban TEXT, swift TEXT, bank_name TEXT, receiver_name TEXT,
  rate_usd NUMERIC, address TEXT, phone TEXT
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
  RETURN QUERY SELECT es.* FROM public.employees_safe es WHERE es.id = p_employee_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_employee_safe(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_employee_safe(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_employees_safe()
RETURNS TABLE (
  id UUID, pin TEXT, name TEXT, full_name_lat TEXT, work_email TEXT, email TEXT,
  employee_type TEXT, contract_type TEXT, is_active BOOLEAN,
  invoice_format TEXT, invoice_prefix TEXT, next_invoice_number INTEGER,
  service_description TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  contract_uploaded_at TIMESTAMPTZ, nda_uploaded_at TIMESTAMPTZ,
  iban TEXT, swift TEXT, bank_name TEXT, receiver_name TEXT,
  rate_usd NUMERIC, address TEXT, phone TEXT
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
  RETURN QUERY SELECT es.* FROM public.employees_safe es WHERE es.is_active = true ORDER BY es.name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_employees_safe() FROM public;
GRANT EXECUTE ON FUNCTION public.get_employees_safe() TO authenticated;


-- ============================================================
-- 5. RPC: update_my_profile
--    Whitelist of fields a viewer can edit on their own profile.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL,
  p_swift TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_receiver_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_emp_id := public.get_my_employee_id();
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'No employee record linked to your account';
  END IF;

  UPDATE public.employees
  SET
    address = COALESCE(p_address, address),
    phone = COALESCE(p_phone, phone),
    iban = COALESCE(p_iban, iban),
    swift = COALESCE(p_swift, swift),
    bank_name = COALESCE(p_bank_name, bank_name),
    receiver_name = COALESCE(p_receiver_name, receiver_name),
    updated_at = now()
  WHERE id = v_emp_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_profile FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;


-- ============================================================
-- 6. RPC: create_invoice_for_self
--    Like create_invoice_atomic but employee_id is auto-resolved.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invoice_for_self(
  p_invoice_number TEXT,
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
  v_emp_id UUID;
  v_invoice_id UUID;
  v_item JSONB;
  v_item_order INTEGER := 1;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Resolve employee
  v_emp_id := public.get_my_employee_id();
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'No employee record linked to your account';
  END IF;

  -- Month lock check
  IF public.is_month_locked(p_month, p_year) THEN
    RAISE EXCEPTION 'Month %/% is locked', p_month, p_year;
  END IF;

  -- Validate status (viewer can only create draft/generated)
  IF p_status NOT IN ('draft', 'generated') THEN
    RAISE EXCEPTION 'Viewers can only create draft or generated invoices';
  END IF;

  -- Check no duplicate invoice for this employee/month/year
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE employee_id = v_emp_id AND month = p_month AND year = p_year
  ) THEN
    RAISE EXCEPTION 'Invoice already exists for this period';
  END IF;

  -- Insert invoice
  INSERT INTO public.invoices (
    employee_id, invoice_number, invoice_date, month, year,
    format_type, subtotal_usd, discount_usd, tax_usd, total_usd, status, created_by
  ) VALUES (
    v_emp_id, p_invoice_number, p_invoice_date, p_month, p_year,
    p_format_type, p_subtotal_usd, p_discount_usd, p_tax_usd, p_total_usd, p_status, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  -- Insert items
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

  -- Increment invoice number
  UPDATE public.employees
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = v_emp_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_for_self FROM public;
GRANT EXECUTE ON FUNCTION public.create_invoice_for_self TO authenticated;


-- ============================================================
-- 7. RPC: update_invoice_for_self
--    Viewer can edit own draft/generated invoices.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_invoice_for_self(
  p_invoice_id UUID,
  p_invoice_date DATE,
  p_subtotal_usd NUMERIC(10,2),
  p_total_usd NUMERIC(10,2),
  p_discount_usd NUMERIC(10,2) DEFAULT 0,
  p_tax_usd NUMERIC(10,2) DEFAULT 0,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id UUID;
  v_invoice RECORD;
  v_item JSONB;
  v_item_order INTEGER := 1;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Resolve employee
  v_emp_id := public.get_my_employee_id();
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'No employee record linked to your account';
  END IF;

  -- Fetch invoice
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Ownership check
  IF v_invoice.employee_id <> v_emp_id THEN
    RAISE EXCEPTION 'Permission denied: not your invoice';
  END IF;

  -- Status check
  IF v_invoice.status NOT IN ('draft', 'generated') THEN
    RAISE EXCEPTION 'Can only edit draft or generated invoices';
  END IF;

  -- Month lock check
  IF public.is_month_locked(v_invoice.month, v_invoice.year) THEN
    RAISE EXCEPTION 'Month %/% is locked', v_invoice.month, v_invoice.year;
  END IF;

  -- Delete old items
  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  -- Insert new items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, item_order, description, price_usd, qty, total_usd
    ) VALUES (
      p_invoice_id,
      COALESCE((v_item->>'item_order')::INTEGER, v_item_order),
      v_item->>'description',
      (v_item->>'price_usd')::NUMERIC(10,2),
      COALESCE((v_item->>'qty')::NUMERIC(10,4), 1),
      (v_item->>'total_usd')::NUMERIC(10,2)
    );
    v_item_order := v_item_order + 1;
  END LOOP;

  -- Update totals
  UPDATE public.invoices
  SET
    invoice_date = p_invoice_date,
    subtotal_usd = p_subtotal_usd,
    discount_usd = p_discount_usd,
    tax_usd = p_tax_usd,
    total_usd = p_total_usd,
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN p_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_invoice_for_self FROM public;
GRANT EXECUTE ON FUNCTION public.update_invoice_for_self TO authenticated;


-- ============================================================
-- 8. RPC: delete_invoice_for_self
--    Viewer can delete own draft/generated invoices.
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_invoice_for_self(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id UUID;
  v_invoice RECORD;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Resolve employee
  v_emp_id := public.get_my_employee_id();
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'No employee record linked to your account';
  END IF;

  -- Fetch invoice
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Ownership check
  IF v_invoice.employee_id <> v_emp_id THEN
    RAISE EXCEPTION 'Permission denied: not your invoice';
  END IF;

  -- Status check
  IF v_invoice.status NOT IN ('draft', 'generated') THEN
    RAISE EXCEPTION 'Can only delete draft or generated invoices';
  END IF;

  -- Month lock check
  IF public.is_month_locked(v_invoice.month, v_invoice.year) THEN
    RAISE EXCEPTION 'Month %/% is locked', v_invoice.month, v_invoice.year;
  END IF;

  -- Delete (CASCADE will remove invoice_items and expenses)
  DELETE FROM public.invoices WHERE id = p_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_invoice_for_self FROM public;
GRANT EXECUTE ON FUNCTION public.delete_invoice_for_self TO authenticated;


-- ============================================================
-- 9. RLS: expenses for viewer
--    Allow INSERT/UPDATE/DELETE on expenses linked to own
--    draft/generated invoices.
-- ============================================================

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "expenses_viewer_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_viewer_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_viewer_delete" ON public.expenses;

-- INSERT: viewer can add expenses to own draft/generated invoices
CREATE POLICY "expenses_viewer_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_lead()
    OR (
      invoice_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
          AND i.employee_id = public.get_my_employee_id()
          AND i.status IN ('draft', 'generated')
      )
    )
    OR invoice_id IS NULL
  );

-- UPDATE: viewer can edit expenses on own draft/generated invoices
CREATE POLICY "expenses_viewer_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_lead()
    OR (
      invoice_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
          AND i.employee_id = public.get_my_employee_id()
          AND i.status IN ('draft', 'generated')
      )
    )
    OR invoice_id IS NULL
  );

-- DELETE: viewer can delete expenses on own draft/generated invoices
CREATE POLICY "expenses_viewer_delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_lead()
    OR (
      invoice_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
          AND i.employee_id = public.get_my_employee_id()
          AND i.status IN ('draft', 'generated')
      )
    )
    OR invoice_id IS NULL
  );


COMMIT;

-- ============================================================
-- MIGRATION NOTES:
--
-- 1. get_my_employee_id() — central helper for user↔employee link
-- 2. employees_safe — now reveals own financial data to viewer
-- 3. update_my_profile — whitelist: address, phone, iban, swift,
--    bank_name, receiver_name. NOT rate_usd, name, employee_type
-- 4. create/update/delete_invoice_for_self — viewer CRUD on own
--    invoices, restricted to draft/generated status
-- 5. timesheet_suggestions — viewer suggests, admin accepts
-- 6. expenses RLS — viewer can CRUD on own draft/generated invoices
--
-- SECURITY:
-- - All RPC functions use SECURITY DEFINER + SET search_path
-- - Auth guard (auth.uid() IS NULL) on all RPCs
-- - Ownership checked via get_my_employee_id()
-- - Status restricted to draft/generated for viewer operations
-- - Month lock checked in all write operations
-- ============================================================
