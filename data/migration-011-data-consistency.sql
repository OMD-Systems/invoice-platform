-- ============================================================
-- Migration 011: Data Consistency Fixes
-- - Add updated_at to employees for optimistic locking
-- - Stricter invoice status state machine
-- - Delete cascade for expenses when invoice deleted
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADD updated_at TO employees (for concurrent edit detection)
-- ============================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_employees_updated_at ON employees;
CREATE TRIGGER tr_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employees_updated_at();


-- ============================================================
-- 2. STRICTER INVOICE STATUS STATE MACHINE
--    Replaces the trigger from migration-008.
--    Forward-only for non-admins: draft -> generated -> sent -> paid
--    Admins can go any direction.
-- ============================================================

CREATE OR REPLACE FUNCTION check_invoice_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_valid BOOLEAN := false;
BEGIN
  -- Skip if status not changing
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(public.get_my_role(), 'viewer');

  -- Admins can change status freely
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admins: forward-only transitions
  CASE OLD.status
    WHEN 'draft' THEN
      v_valid := NEW.status IN ('generated', 'sent');
    WHEN 'generated' THEN
      v_valid := NEW.status IN ('sent');
    WHEN 'sent' THEN
      v_valid := NEW.status IN ('paid');
    WHEN 'paid' THEN
      v_valid := false;
    ELSE
      v_valid := false;
  END CASE;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Invalid status transition: % -> % (only admins can revert status)', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- 3. CASCADE DELETE expenses WHEN INVOICE IS DELETED
--    Currently deleteInvoice in db.js manually deletes items
--    but expenses linked to the invoice are orphaned.
-- ============================================================

-- Drop existing FK if any, then add with CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_invoice_id_fkey;
    ALTER TABLE expenses ADD CONSTRAINT expenses_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- 4. ADD updated_at TO invoices (for concurrent edit tracking)
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_invoices_updated_at ON invoices;
CREATE TRIGGER tr_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();


COMMIT;
