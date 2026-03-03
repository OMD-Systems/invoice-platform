-- migration-004-strict-rls.sql
-- Enforce strict Row Level Security (RLS) for Employees

-- 1. Profiles: Employees can only see their own profile. Admins/Leads can see all.
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lead'))
  );

-- 2. Employees: Employees can only see their own employee record. Admins/Leads see all.
DROP POLICY IF EXISTS "employees_select_authenticated" ON public.employees;
CREATE POLICY "employees_select_policy" ON public.employees 
  FOR SELECT TO authenticated 
  USING (
    (work_email = (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lead'))
  );

-- 3. Invoices: Employees can only see their own invoices. Admins/Leads see all.
DROP POLICY IF EXISTS "invoices_select_authenticated" ON public.invoices;
CREATE POLICY "invoices_select_policy" ON public.invoices 
  FOR SELECT TO authenticated 
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lead'))
  );

-- 4. Timesheets: Employees see their own timesheets. Admins/Leads see all.
DROP POLICY IF EXISTS "timesheets_select_authenticated" ON public.timesheets;
CREATE POLICY "timesheets_select_policy" ON public.timesheets 
  FOR SELECT TO authenticated 
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e 
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lead'))
  );

-- 5. Invoice Items: Employees see items for their invoices. Admins/Leads see all.
DROP POLICY IF EXISTS "invoice_items_select_authenticated" ON public.invoice_items;
CREATE POLICY "invoice_items_select_policy" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.employees e ON i.employee_id = e.id
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lead'))
  );

-- 6. Expenses: Employees see expenses for their invoices. Admins/Leads see all.
DROP POLICY IF EXISTS "expenses_select_authenticated" ON public.expenses;
CREATE POLICY "expenses_select_policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM public.invoices i
      JOIN public.employees e ON i.employee_id = e.id
      WHERE e.work_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid()) OR e.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'lead'))
  );

-- 7. Add email column to employees if missing to ensure linking works
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='email') THEN
    ALTER TABLE public.employees ADD COLUMN email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='work_email') THEN
    ALTER TABLE public.employees ADD COLUMN work_email TEXT;
  END IF;
END $$;
