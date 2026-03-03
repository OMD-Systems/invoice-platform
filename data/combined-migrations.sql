-- ============================================================
-- Migration 002: Fix infinite recursion in profiles RLS
-- Problem: policies on profiles reference profiles → infinite loop
-- Solution: SECURITY DEFINER function + clean policies
-- Run in Supabase SQL Editor (one-time)
-- ============================================================

-- 1. Create a SECURITY DEFINER function to get current user's role
--    This bypasses RLS, so no recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 2. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 3. Drop ALL existing policies on profiles to clean up recursion
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 4. Create clean, non-recursive policies
-- All authenticated users can read all profiles (needed for role checks)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Users can update their own profile (name, etc.)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admin can update any profile (role changes)
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (
    (SELECT public.get_my_role()) = 'admin'
  );

-- Admin can insert new profiles
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.get_my_role()) = 'admin'
  );

-- Admin can delete profiles
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated USING (
    (SELECT public.get_my_role()) = 'admin'
  );

-- ============================================================
-- Done! The getUserRole query should now work without recursion.
-- ============================================================
-- ============================================================
-- Migration 003: Security fixes
-- 1. Create atomic invoice creation function
-- 2. Fix year constraint (extend to 2040)
-- Run in Supabase SQL Editor (one-time)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Atomic Invoice Creation (SECURITY DEFINER)
--    Wraps invoice + items + number increment in one transaction
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION create_invoice_atomic TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. Fix year constraint to extend beyond 2030
-- ────────────────────────────────────────────────────────────
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_year_check;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_year_check
  CHECK (year BETWEEN 2024 AND 2040);


-- ────────────────────────────────────────────────────────────
-- Done!
-- ────────────────────────────────────────────────────────────
