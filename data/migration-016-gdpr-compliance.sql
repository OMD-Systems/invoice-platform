-- Migration 016: GDPR Compliance Functions
-- Depends on: migration-015 (audit_log table)
-- Created: 2026-03-06
--
-- Implements:
--   - anonymize_employee(): GDPR Art.17 right to erasure (anonymizes PII, keeps financial records)
--   - export_employee_data(): GDPR Art.20 data portability
--   - teams.lead_email deprecation comment

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. anonymize_employee
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anonymize_employee(p_employee_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Admin only
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only administrators can anonymize employee data';
  END IF;

  -- Verify employee exists and is inactive
  IF NOT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id AND is_active = false) THEN
    RAISE EXCEPTION 'Employee must be inactive before anonymization';
  END IF;

  UPDATE employees SET
    name = 'ANONYMIZED',
    full_name_lat = 'ANONYMIZED',
    email = NULL,
    work_email = NULL,
    phone = NULL,
    address = NULL,
    iban = NULL,
    swift = NULL,
    bank_name = NULL,
    receiver_name = NULL,
    passport_number = NULL,
    date_of_birth = NULL,
    passport_issued = NULL,
    passport_expires = NULL,
    avatar_url = NULL
  WHERE id = p_employee_id;

  -- Log the anonymization
  INSERT INTO audit_log (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'anonymize', 'employees', p_employee_id::text, '{"reason":"GDPR erasure request"}'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION anonymize_employee(UUID) FROM public;
GRANT EXECUTE ON FUNCTION anonymize_employee(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. export_employee_data
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION export_employee_data(p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_employee JSONB;
  v_invoices JSONB;
  v_timesheets JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only administrators can export employee data';
  END IF;

  SELECT to_jsonb(e.*) INTO v_employee FROM employees e WHERE e.id = p_employee_id;
  IF v_employee IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(i.*)), '[]'::jsonb) INTO v_invoices
  FROM invoices i WHERE i.employee_id = p_employee_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(t.*)), '[]'::jsonb) INTO v_timesheets
  FROM timesheets t WHERE t.employee_id = p_employee_id;

  v_result := jsonb_build_object(
    'export_date', now(),
    'employee', v_employee,
    'invoices', v_invoices,
    'timesheets', v_timesheets
  );

  -- Log the export
  INSERT INTO audit_log (user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'export', 'employees', p_employee_id::text, '{"reason":"GDPR data portability"}'::jsonb);

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION export_employee_data(UUID) FROM public;
GRANT EXECUTE ON FUNCTION export_employee_data(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Deprecation comment on teams.lead_email
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN teams.lead_email IS 'DEPRECATED: Should be migrated to lead_id UUID REFERENCES profiles(id). Currently matched by email which can break if email changes.';

COMMIT;
