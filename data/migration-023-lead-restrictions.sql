-- Migration 023: Restrict sensitive data from Lead role
-- Lead should NOT see: rate_usd, bank details, personal addresses/phones, passport data
-- Only admin and own profile can see these fields

-- 1. Create is_admin() helper (admin only, NOT lead)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Recreate employees_safe VIEW: sensitive fields visible only to admin OR own profile
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

  -- Sensitive fields: visible to admin OR own profile only (NOT lead)
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN iban ELSE NULL END AS iban,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN swift ELSE NULL END AS swift,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN bank_name ELSE NULL END AS bank_name,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN receiver_name ELSE NULL END AS receiver_name,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN rate_usd ELSE NULL END AS rate_usd,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN address ELSE NULL END AS address,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN phone ELSE NULL END AS phone,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN date_of_birth ELSE NULL END AS date_of_birth,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN passport_number ELSE NULL END AS passport_number,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN passport_issued ELSE NULL END AS passport_issued,
  CASE WHEN public.is_admin() OR id = public.get_my_employee_id()
    THEN passport_expires ELSE NULL END AS passport_expires

FROM public.employees;

-- 3. Recreate get_employees_safe() RPC
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
