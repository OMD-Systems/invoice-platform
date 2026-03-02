-- ============================================================
-- Migration 001: New columns + tables + Slack email mapping
-- OMD Finance Platform
-- Run in Supabase SQL Editor (one-time)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ALTER TABLE employees — new columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'Contractor';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_uploaded_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nda_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_employees_work_email ON employees(work_email);

-- ────────────────────────────────────────────────────────────
-- 2. Map Slack emails to employees
-- ────────────────────────────────────────────────────────────
UPDATE employees SET work_email = 'ihordutchak@omdsystems.com' WHERE name = 'Dutchak, Ihor';
UPDATE employees SET work_email = 'bhorokhov@omdsystems.com' WHERE name = 'Horokhov, Borys';
UPDATE employees SET work_email = 'denys.homyakov@omdsystems.com' WHERE name = 'Khomiakov, Denys';
UPDATE employees SET work_email = 'vadim@omdsystems.com' WHERE name = 'Khvostov, Vadim';
UPDATE employees SET work_email = 'lena@omdsystems.com' WHERE name = 'Mytrofaniuk, Lena';
UPDATE employees SET work_email = 'perss@omdsystems.com' WHERE name = 'Persisty, Konstantin';
UPDATE employees SET work_email = 'dmitry.siem@omdsystems.com' WHERE name = 'Siemonov, Dmitry';
UPDATE employees SET work_email = 'pv@omdsystems.com' WHERE name = 'Volyk, Pavel';

-- Employees not found in Slack (no email match yet):
-- Dubina, Andrii
-- Galinsky, Andrii
-- Kolodiaziev, Dmytro
-- Kunytskyi, Vadym
-- Sem, Dmytro
-- Shunin, Oleksandr
-- Trotsko, Andrii
-- Tydnyuk, Maksym

-- Slack users not in employees table:
-- Slava (slava@omdsystems.com) — Chief Engineer
-- Aleksandr Gusarov (aleksandr.gusarov@omdsystems.com) — Embedded Systems
-- Abhishek (abhishek@omdsystems.com) — Embedded SW Engineer
-- Petrov Oleksandr (petrov_av@omdsystems.com) — R&D Engineer

-- ────────────────────────────────────────────────────────────
-- 3. CREATE TABLE email_requests
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','created')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_requests ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "email_requests_select_all" ON email_requests
  FOR SELECT TO authenticated USING (true);

-- Admin can insert
CREATE POLICY "email_requests_insert_admin" ON email_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Lead can insert for their team
CREATE POLICY "email_requests_insert_lead" ON email_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid() AND p.role = 'lead'
        AND tm.employee_id = email_requests.employee_id
    )
  );

-- Admin can update
CREATE POLICY "email_requests_update_admin" ON email_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admin can delete
CREATE POLICY "email_requests_delete_admin" ON email_requests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_email_requests_employee ON email_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_email_requests_status ON email_requests(status);

-- ────────────────────────────────────────────────────────────
-- 4. CREATE TABLE working_hours_config
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS working_hours_config (
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  working_days INTEGER NOT NULL,
  hours_per_day NUMERIC(4,1) DEFAULT 8.0,
  adjustment_hours NUMERIC(4,1) DEFAULT 0,
  notes TEXT,
  PRIMARY KEY (month, year)
);

ALTER TABLE working_hours_config ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "working_hours_config_select_all" ON working_hours_config
  FOR SELECT TO authenticated USING (true);

-- Admin can insert
CREATE POLICY "working_hours_config_insert_admin" ON working_hours_config
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admin can update
CREATE POLICY "working_hours_config_update_admin" ON working_hours_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admin can delete
CREATE POLICY "working_hours_config_delete_admin" ON working_hours_config
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ────────────────────────────────────────────────────────────
-- 5. Settings seed
-- ────────────────────────────────────────────────────────────
INSERT INTO settings (key, value)
VALUES ('email_admin', '{"email":"","name":"Email Admin"}')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. Auto-sync trigger: email_requests status='created' → employees.work_email
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_email_on_request_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'created' AND (OLD.status IS DISTINCT FROM 'created') THEN
    UPDATE employees
    SET work_email = (
      SELECT p.email FROM profiles p WHERE p.id = NEW.requested_by
    )
    WHERE id = NEW.employee_id AND work_email IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_email_request_created ON email_requests;
CREATE TRIGGER tr_email_request_created
  AFTER UPDATE ON email_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_on_request_created();

-- ────────────────────────────────────────────────────────────
-- Done!
-- ────────────────────────────────────────────────────────────
