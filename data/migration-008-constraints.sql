-- ============================================================
-- Migration 008: Schema Security Constraints
-- - Month lock enforcement triggers
-- - CHECK constraints for positive amounts
-- - ON DELETE RESTRICT (replace CASCADE)
-- - Invoice status state machine trigger
-- - UNIQUE(employee_id, invoice_number) constraint
-- ============================================================

BEGIN;

-- ============================================================
-- 1. MONTH LOCK ENFORCEMENT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION check_month_not_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM month_locks WHERE month = NEW.month AND year = NEW.year) THEN
    RAISE EXCEPTION 'Month %/% is locked', NEW.month, NEW.year;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_timesheets_check_month_lock ON timesheets;
CREATE TRIGGER tr_timesheets_check_month_lock
  BEFORE INSERT OR UPDATE ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION check_month_not_locked();

DROP TRIGGER IF EXISTS tr_invoices_check_month_lock ON invoices;
CREATE TRIGGER tr_invoices_check_month_lock
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_month_not_locked();


-- ============================================================
-- 2. CHECK CONSTRAINTS FOR POSITIVE AMOUNTS
-- ============================================================

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_subtotal_positive;
ALTER TABLE invoices ADD CONSTRAINT invoices_subtotal_positive CHECK (subtotal_usd >= 0);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_total_positive;
ALTER TABLE invoices ADD CONSTRAINT invoices_total_positive CHECK (total_usd >= 0);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_discount_positive;
ALTER TABLE invoices ADD CONSTRAINT invoices_discount_positive CHECK (discount_usd >= 0);

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_tax_positive;
ALTER TABLE invoices ADD CONSTRAINT invoices_tax_positive CHECK (tax_usd >= 0);

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS items_price_positive;
ALTER TABLE invoice_items ADD CONSTRAINT items_price_positive CHECK (price_usd >= 0);

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS items_total_positive;
ALTER TABLE invoice_items ADD CONSTRAINT items_total_positive CHECK (total_usd >= 0);

ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_hours_positive;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_hours_positive CHECK (hours >= 0);

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_rate_positive;
ALTER TABLE employees ADD CONSTRAINT employees_rate_positive CHECK (rate_usd >= 0 OR rate_usd IS NULL);


-- ============================================================
-- 3. ON DELETE RESTRICT (replace CASCADE)
-- ============================================================

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_employee_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_employee_id_fkey;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_project_id_fkey;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;


-- ============================================================
-- 4. INVOICE STATUS STATE MACHINE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION check_invoice_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    -- Only admin can revert paid status
    IF public.get_my_role() != 'admin' THEN
      RAISE EXCEPTION 'Only admin can revert paid invoices';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_invoices_status_transition ON invoices;
CREATE TRIGGER tr_invoices_status_transition
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_invoice_status_transition();


-- ============================================================
-- 5. UNIQUE CONSTRAINT: employee_id + invoice_number
-- ============================================================

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_employee_invoice_number_unique;
ALTER TABLE invoices ADD CONSTRAINT invoices_employee_invoice_number_unique
  UNIQUE (employee_id, invoice_number);


COMMIT;
