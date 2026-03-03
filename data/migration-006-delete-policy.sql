-- migration-006-delete-policy.sql
-- Fix 'Delete Invoice' failing silently via DB API
-- We previously secured SELECT with RLS but administrators need DELETE permissions

-- Drop existing delete policy if it exists (for idempotency)
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;

-- Add DELETE policy for administrators and leads
CREATE POLICY "invoices_delete_policy" ON public.invoices 
  FOR DELETE TO authenticated 
  USING ( public.is_admin_or_lead() );
