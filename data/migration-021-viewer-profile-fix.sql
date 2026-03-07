-- ============================================================
-- Migration 021: Viewer Profile Fix
--
-- 1. Fix create_invoice_for_self: p_invoice_number TEXT → INTEGER
-- 2. Expand update_my_profile with passport fields
-- 3. Update employees_safe VIEW to include passport/personal fields
-- 4. Update get_employee_safe/get_employees_safe return types
--
-- Depends on: migration-019
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Fix create_invoice_for_self: invoice_number type TEXT → INTEGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invoice_for_self(
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
  v_emp_id UUID;
  v_invoice_id UUID;
  v_item JSONB;
  v_item_order INTEGER := 1;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_emp_id := public.get_my_employee_id();
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'No employee record linked to your account';
  END IF;

  IF public.is_month_locked(p_month, p_year) THEN
    RAISE EXCEPTION 'Month %/% is locked', p_month, p_year;
  END IF;

  IF p_status NOT IN ('draft', 'generated') THEN
    RAISE EXCEPTION 'Viewers can only create draft or generated invoices';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE employee_id = v_emp_id AND month = p_month AND year = p_year
  ) THEN
    RAISE EXCEPTION 'Invoice already exists for this period';
  END IF;

  INSERT INTO public.invoices (
    employee_id, invoice_number, invoice_date, month, year,
    format_type, subtotal_usd, discount_usd, tax_usd, total_usd, status, created_by
  ) VALUES (
    v_emp_id, p_invoice_number, p_invoice_date, p_month, p_year,
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
  WHERE id = v_emp_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_for_self FROM public;
GRANT EXECUTE ON FUNCTION public.create_invoice_for_self TO authenticated;


-- ============================================================
-- 2. Expand update_my_profile with passport/personal fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_iban TEXT DEFAULT NULL,
  p_swift TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_receiver_name TEXT DEFAULT NULL,
  p_full_name_lat TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_passport_number TEXT DEFAULT NULL,
  p_passport_issued DATE DEFAULT NULL,
  p_passport_expires DATE DEFAULT NULL
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
    full_name_lat = COALESCE(p_full_name_lat, full_name_lat),
    date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
    passport_number = COALESCE(p_passport_number, passport_number),
    passport_issued = COALESCE(p_passport_issued, passport_issued),
    passport_expires = COALESCE(p_passport_expires, passport_expires),
    updated_at = now()
  WHERE id = v_emp_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_profile FROM public;
GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;


-- ============================================================
-- 3. Update employees_safe VIEW — add passport/personal fields
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
  agreement_date,
  effective_date,

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
    THEN phone ELSE NULL END AS phone,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN date_of_birth ELSE NULL END AS date_of_birth,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN passport_number ELSE NULL END AS passport_number,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN passport_issued ELSE NULL END AS passport_issued,
  CASE WHEN public.is_admin_or_lead() OR id = public.get_my_employee_id()
    THEN passport_expires ELSE NULL END AS passport_expires

FROM public.employees;

GRANT SELECT ON public.employees_safe TO authenticated;


-- ============================================================
-- 4. Recreate get_employee_safe / get_employees_safe
--    with new return columns
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_employee_safe(p_employee_id UUID)
RETURNS TABLE (
  id UUID, pin TEXT, name TEXT, full_name_lat TEXT, work_email TEXT, email TEXT,
  employee_type TEXT, contract_type TEXT, is_active BOOLEAN,
  invoice_format TEXT, invoice_prefix TEXT, next_invoice_number INTEGER,
  service_description TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  contract_uploaded_at TIMESTAMPTZ, nda_uploaded_at TIMESTAMPTZ,
  agreement_date DATE, effective_date DATE,
  iban TEXT, swift TEXT, bank_name TEXT, receiver_name TEXT,
  rate_usd NUMERIC, address TEXT, phone TEXT,
  date_of_birth DATE, passport_number TEXT, passport_issued DATE, passport_expires DATE
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
  agreement_date DATE, effective_date DATE,
  iban TEXT, swift TEXT, bank_name TEXT, receiver_name TEXT,
  rate_usd NUMERIC, address TEXT, phone TEXT,
  date_of_birth DATE, passport_number TEXT, passport_issued DATE, passport_expires DATE
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


COMMIT;
