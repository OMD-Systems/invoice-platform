-- Migration 020: Fix expenses RLS policies
-- Remove "OR invoice_id IS NULL" from viewer policies — expenses must always belong to an invoice
BEGIN;

-- Drop and recreate INSERT policy
DROP POLICY IF EXISTS "expenses_viewer_insert" ON public.expenses;
CREATE POLICY "expenses_viewer_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin_or_lead()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
          AND i.employee_id = public.get_my_employee_id()
          AND i.status IN ('draft', 'generated')
    )
  );

-- Drop and recreate UPDATE policy
DROP POLICY IF EXISTS "expenses_viewer_update" ON public.expenses;
CREATE POLICY "expenses_viewer_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    NOT public.is_admin_or_lead()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
          AND i.employee_id = public.get_my_employee_id()
          AND i.status IN ('draft', 'generated')
    )
  );

-- Drop and recreate DELETE policy
DROP POLICY IF EXISTS "expenses_viewer_delete" ON public.expenses;
CREATE POLICY "expenses_viewer_delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    NOT public.is_admin_or_lead()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id
          AND i.employee_id = public.get_my_employee_id()
          AND i.status IN ('draft', 'generated')
    )
  );

COMMIT;
