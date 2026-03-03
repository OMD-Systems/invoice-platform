-- ============================================================
-- Migration 009: Invoice Generation Fixes
-- Fixes: qty truncation, missing discount/tax in RPC
-- Run in Supabase SQL Editor (one-time, idempotent)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Recreate create_invoice_atomic with fixes:
--    a) qty: ::INTEGER → ::NUMERIC(10,4) (monthly employees have fractional qty like 0.476)
--    b) Add p_discount_usd and p_tax_usd parameters
--    c) Include discount_usd, tax_usd in INSERT
-- ────────────────────────────────────────────────────────────

-- Drop old 10-param signature first (new one has 12 params — PG treats as different function)
DROP FUNCTION IF EXISTS create_invoice_atomic(UUID, INTEGER, DATE, INTEGER, INTEGER, TEXT, NUMERIC, NUMERIC, TEXT, JSONB);

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
  p_items JSONB DEFAULT '[]'::jsonb,
  p_discount_usd NUMERIC(10,2) DEFAULT 0,
  p_tax_usd NUMERIC(10,2) DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_item JSONB;
  v_item_order INTEGER := 1;
BEGIN
  -- Role check
  IF NOT public.is_admin_or_lead() THEN
    RAISE EXCEPTION 'Permission denied: only admin or lead can create invoices';
  END IF;

  -- Lead team check
  IF public.get_my_role() = 'lead' THEN
    IF NOT EXISTS (
      SELECT 1 FROM teams t
      JOIN team_members tm ON tm.team_id = t.id
      WHERE t.lead_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND tm.employee_id = p_employee_id
    ) THEN
      RAISE EXCEPTION 'Permission denied: employee not in your team';
    END IF;
  END IF;

  -- Month lock check
  IF public.is_month_locked(p_month, p_year) THEN
    RAISE EXCEPTION 'Month %/% is locked', p_month, p_year;
  END IF;

  -- Insert the invoice (now includes discount_usd and tax_usd)
  INSERT INTO invoices (
    employee_id, invoice_number, invoice_date, month, year,
    format_type, subtotal_usd, discount_usd, tax_usd, total_usd, status, created_by
  ) VALUES (
    p_employee_id, p_invoice_number, p_invoice_date, p_month, p_year,
    p_format_type, p_subtotal_usd, p_discount_usd, p_tax_usd, p_total_usd, p_status, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  -- Insert all line items from the JSONB array
  -- FIX: qty cast to NUMERIC instead of INTEGER (monthly employees have fractional qty)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO invoice_items (
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

  -- Atomically increment the employee's invoice number
  UPDATE employees
  SET next_invoice_number = next_invoice_number + 1
  WHERE id = p_employee_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION create_invoice_atomic TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 2. Change invoice_items.qty column type from INTEGER to NUMERIC
--    (if it's still INTEGER — idempotent)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Only alter if column is currently integer type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoice_items'
      AND column_name = 'qty'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE invoice_items ALTER COLUMN qty TYPE NUMERIC(10,4);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- Done! Invoice RPC and qty type fixed.
-- ────────────────────────────────────────────────────────────
