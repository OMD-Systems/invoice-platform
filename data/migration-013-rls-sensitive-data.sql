-- ============================================================
-- Migration 013: Column-Level Security for Sensitive Employee Data
--
-- Problem: All authenticated users (including viewers seeing their own record
-- and leads seeing team records) can access financial fields:
-- iban, swift, bank_name, receiver_name, rate_usd, address, phone
--
-- Solution: Secure VIEW that masks sensitive columns based on role.
-- - admin: sees everything
-- - lead: sees everything (needs financial data for invoice generation)
-- - viewer: sees only non-sensitive fields (name, email, role, type, avatar)
--
-- PostgreSQL RLS is row-level only. Column-level security requires a VIEW.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Helper function: check if current user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(public.get_my_role(), 'viewer') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 2. Secure VIEW: employees_safe
--    Wraps the employees table, masking sensitive columns for viewers.
--    Admin and lead see all fields. Viewer sees nulls for financial data.
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

  -- Sensitive financial fields: only admin/lead can see
  CASE WHEN public.is_admin_or_lead() THEN iban         ELSE NULL END AS iban,
  CASE WHEN public.is_admin_or_lead() THEN swift        ELSE NULL END AS swift,
  CASE WHEN public.is_admin_or_lead() THEN bank_name    ELSE NULL END AS bank_name,
  CASE WHEN public.is_admin_or_lead() THEN receiver_name ELSE NULL END AS receiver_name,
  CASE WHEN public.is_admin_or_lead() THEN rate_usd     ELSE NULL END AS rate_usd,
  CASE WHEN public.is_admin_or_lead() THEN address      ELSE NULL END AS address,
  CASE WHEN public.is_admin_or_lead() THEN phone        ELSE NULL END AS phone

FROM public.employees;

-- Grant access to authenticated users (underlying RLS on employees still applies)
GRANT SELECT ON public.employees_safe TO authenticated;

COMMENT ON VIEW public.employees_safe IS
  'Secure view over employees table. Masks iban, swift, bank_name, receiver_name, rate_usd, address, phone for viewer role.';


-- ============================================================
-- 3. Secure VIEW: profiles_safe
--    Viewer only sees id, email, full_name, role, created_at.
--    Admin/lead see everything (currently profiles has no extra sensitive fields,
--    but this future-proofs the schema).
-- ============================================================
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe AS
SELECT
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;

COMMENT ON VIEW public.profiles_safe IS
  'Secure view over profiles. Currently exposes all columns since profiles has no sensitive financial data.';


-- ============================================================
-- 4. RPC: get_employee_safe
--    Returns a single employee with column masking applied.
--    Useful when the frontend needs a single record via RPC
--    instead of querying the view directly.
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT es.*
  FROM public.employees_safe es
  WHERE es.id = p_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_employee_safe(UUID) TO authenticated;


-- ============================================================
-- 5. RPC: get_employees_safe
--    Returns all active employees with column masking.
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT es.*
  FROM public.employees_safe es
  WHERE es.is_active = true
  ORDER BY es.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_employees_safe() TO authenticated;


COMMIT;

-- ============================================================
-- MIGRATION NOTES:
--
-- This migration does NOT change existing RLS policies on the
-- employees table. The underlying row-level access remains:
--   - viewer: sees only their own record (by work_email/email match)
--   - lead: sees all records
--   - admin: sees all records
--
-- The VIEW adds column-level masking on TOP of RLS:
--   - viewer: even on their own record, financial fields are NULL
--   - lead/admin: see all columns
--
-- FRONTEND MIGRATION PATH:
-- To enforce column-level security, the frontend should switch from:
--   .from('employees').select('...')
-- to:
--   .from('employees_safe').select('...')
-- or use the RPC functions:
--   .rpc('get_employees_safe')
--   .rpc('get_employee_safe', { p_employee_id: id })
--
-- Write operations (INSERT/UPDATE/DELETE) continue to use the
-- employees table directly — they are protected by existing RLS.
-- ============================================================
