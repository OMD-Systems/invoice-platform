-- migration-005-rls-fix.sql
-- Fix recursive RLS policies causing 500 errors

-- 1. Create a SECURITY DEFINER function to securely check if the current user is an admin or lead
-- This bypasses RLS on the profiles table, preventing infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin_or_lead()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role IN ('admin', 'lead');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "timesheets_select_policy" ON public.timesheets;
DROP POLICY IF EXISTS "invoice_items_select_policy" ON public.invoice_items;
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;

-- 3. Recreate clean policies using the SECURITY DEFINER function

-- Profiles: 
CREATE POLICY "profiles_select_policy" ON public.profiles 
  FOR SELECT TO authenticated 
  USING ( auth.uid() = id OR public.is_admin_or_lead() );

-- Employees:
CREATE POLICY "employees_select_policy" ON public.employees 
  FOR SELECT TO authenticated 
  USING (
    work_email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid()) OR
    email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid()) OR
    public.is_admin_or_lead()
  );

-- Invoices:
CREATE POLICY "invoices_select_policy" ON public.invoices 
  FOR SELECT TO authenticated 
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) 
         OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR public.is_admin_or_lead()
  );

-- Timesheets:
CREATE POLICY "timesheets_select_policy" ON public.timesheets 
  FOR SELECT TO authenticated 
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) 
         OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR public.is_admin_or_lead()
  );

-- Invoice Items:
CREATE POLICY "invoice_items_select_policy" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.employees e ON i.employee_id = e.id
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) 
         OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR public.is_admin_or_lead()
  );

-- Expenses:
CREATE POLICY "expenses_select_policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.employees e ON i.employee_id = e.id
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) 
         OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR public.is_admin_or_lead()
  );
