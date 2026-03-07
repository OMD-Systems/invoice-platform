-- ============================================================
-- Migration 018: update_invoice_atomic — Edit invoice after generation
--
-- Allows admin/lead to update line items, totals, discount, tax
-- on an existing invoice. Deletes old items, inserts new ones.
--
-- Run in Supabase SQL Editor (one-time, idempotent)
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION update_invoice_atomic(
  p_invoice_id UUID,
  p_invoice_date DATE,
  p_subtotal_usd NUMERIC(10,2),
  p_total_usd NUMERIC(10,2),
  p_discount_usd NUMERIC(10,2) DEFAULT 0,
  p_tax_usd NUMERIC(10,2) DEFAULT 0,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_role TEXT;
  v_item JSONB;
  v_item_order INTEGER := 1;
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Role check
  v_role := COALESCE(public.get_my_role(), 'viewer');
  IF v_role NOT IN ('admin', 'lead') THEN
    RAISE EXCEPTION 'Permission denied: only admin or lead can edit invoices';
  END IF;

  -- Fetch existing invoice
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  -- Lead team check
  IF v_role = 'lead' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.team_members tm ON tm.team_id = t.id
      WHERE t.lead_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND tm.employee_id = v_invoice.employee_id
    ) THEN
      RAISE EXCEPTION 'Permission denied: employee not in your team';
    END IF;
  END IF;

  -- Month lock check
  IF public.is_month_locked(v_invoice.month, v_invoice.year) THEN
    RAISE EXCEPTION 'Month %/% is locked', v_invoice.month, v_invoice.year;
  END IF;

  -- Paid status: only admin can edit paid invoices
  IF v_invoice.status = 'paid' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can edit paid invoices';
  END IF;

  -- Delete old items
  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  -- Insert new items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, item_order, description, price_usd, qty, total_usd
    ) VALUES (
      p_invoice_id,
      COALESCE((v_item->>'item_order')::INTEGER, v_item_order),
      v_item->>'description',
      (v_item->>'price_usd')::NUMERIC(10,2),
      COALESCE((v_item->>'qty')::NUMERIC(10,4), 1),
      (v_item->>'total_usd')::NUMERIC(10,2)
    );
    v_item_order := v_item_order + 1;
  END LOOP;

  -- Update invoice totals
  UPDATE public.invoices
  SET
    invoice_date = p_invoice_date,
    subtotal_usd = p_subtotal_usd,
    discount_usd = p_discount_usd,
    tax_usd = p_tax_usd,
    total_usd = p_total_usd,
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN p_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_invoice_atomic FROM public;
GRANT EXECUTE ON FUNCTION update_invoice_atomic TO authenticated;

COMMIT;
