-- ============================================================
-- OMD Finance Platform — PostgreSQL Schema for Supabase
-- seed.sql — Tables, RLS Policies, Seed Data
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'lead', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin can read all profiles
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Users can update their own profile (except role)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can insert profiles
CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Prevent users from changing their own role via profile update
CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_profiles_prevent_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_change();


-- ============================================================
-- 2. EMPLOYEES
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin TEXT UNIQUE,
  name TEXT NOT NULL,
  full_name_lat TEXT,
  address TEXT,
  phone TEXT,
  iban TEXT,
  swift TEXT DEFAULT 'UNJSUAUKXXX',
  bank_name TEXT DEFAULT 'JSC UNIVERSAL BANK, KYIV, UKRAINE',
  receiver_name TEXT,
  service_description TEXT DEFAULT 'UAV Systems Development Services',
  rate_usd NUMERIC(10,2),
  employee_type TEXT DEFAULT 'FTE' CHECK (employee_type IN ('FTE', 'Hourly Contractor')),
  invoice_format TEXT DEFAULT 'WS' CHECK (invoice_format IN ('WS', 'FOP', 'CUSTOM')),
  invoice_prefix TEXT DEFAULT 'WS-Invoice',
  next_invoice_number INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read employees
CREATE POLICY "employees_select_authenticated" ON employees
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert employees
CREATE POLICY "employees_insert_admin" ON employees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can update any employee
CREATE POLICY "employees_update_admin" ON employees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Lead can update employees in their team
CREATE POLICY "employees_update_lead" ON employees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = employees.id
    )
  );

-- Admin can delete employees
CREATE POLICY "employees_delete_admin" ON employees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- 3. TEAMS
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read teams
CREATE POLICY "teams_select_authenticated" ON teams
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert teams
CREATE POLICY "teams_insert_admin" ON teams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can update teams
CREATE POLICY "teams_update_admin" ON teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can delete teams
CREATE POLICY "teams_delete_admin" ON teams
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- 4. TEAM_MEMBERS
-- ============================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE(team_id, employee_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read team members
CREATE POLICY "team_members_select_authenticated" ON team_members
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert team members
CREATE POLICY "team_members_insert_admin" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can delete team members
CREATE POLICY "team_members_delete_admin" ON team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- 5. PROJECTS
-- ============================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  company TEXT NOT NULL CHECK (company IN ('WS', 'OMD', 'OM_ENERGY', 'OM_ENERGY_UA')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read projects
CREATE POLICY "projects_select_authenticated" ON projects
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert projects
CREATE POLICY "projects_insert_admin" ON projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can update projects
CREATE POLICY "projects_update_admin" ON projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can delete projects
CREATE POLICY "projects_delete_admin" ON projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- 6. TIMESHEETS
-- ============================================================
CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2024 AND 2030),
  hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, project_id, month, year)
);

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read timesheets
CREATE POLICY "timesheets_select_authenticated" ON timesheets
  FOR SELECT TO authenticated
  USING (true);

-- Admin can CRUD all timesheets
CREATE POLICY "timesheets_insert_admin" ON timesheets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "timesheets_update_admin" ON timesheets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "timesheets_delete_admin" ON timesheets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Lead can insert timesheets for their team's employees
CREATE POLICY "timesheets_insert_lead" ON timesheets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = timesheets.employee_id
    )
  );

-- Lead can update timesheets for their team's employees
CREATE POLICY "timesheets_update_lead" ON timesheets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = timesheets.employee_id
    )
  );

-- Lead can delete timesheets for their team's employees
CREATE POLICY "timesheets_delete_lead" ON timesheets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = timesheets.employee_id
    )
  );


-- ============================================================
-- 7. INVOICES
-- ============================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  invoice_number INTEGER NOT NULL,
  invoice_date DATE NOT NULL,
  due_days INTEGER DEFAULT 7,
  subtotal_usd NUMERIC(10,2) NOT NULL,
  discount_usd NUMERIC(10,2) DEFAULT 0,
  tax_usd NUMERIC(10,2) DEFAULT 0,
  total_usd NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'paid')),
  format_type TEXT DEFAULT 'WS',
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, month, year, format_type)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read invoices
CREATE POLICY "invoices_select_authenticated" ON invoices
  FOR SELECT TO authenticated
  USING (true);

-- Admin can CRUD all invoices
CREATE POLICY "invoices_insert_admin" ON invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "invoices_update_admin" ON invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "invoices_delete_admin" ON invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Lead can insert invoices for their team
CREATE POLICY "invoices_insert_lead" ON invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = invoices.employee_id
    )
  );

-- Lead can update invoices for their team
CREATE POLICY "invoices_update_lead" ON invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = invoices.employee_id
    )
  );

-- Lead can delete invoices for their team
CREATE POLICY "invoices_delete_lead" ON invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = invoices.employee_id
    )
  );


-- ============================================================
-- 8. INVOICE_ITEMS
-- ============================================================
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  item_order INTEGER DEFAULT 1,
  description TEXT NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  qty INTEGER DEFAULT 1,
  total_usd NUMERIC(10,2) NOT NULL
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read invoice items
CREATE POLICY "invoice_items_select_authenticated" ON invoice_items
  FOR SELECT TO authenticated
  USING (true);

-- Admin can CRUD all invoice items
CREATE POLICY "invoice_items_insert_admin" ON invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "invoice_items_update_admin" ON invoice_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "invoice_items_delete_admin" ON invoice_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Lead can CRUD invoice items for their team's invoices
CREATE POLICY "invoice_items_insert_lead" ON invoice_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      JOIN invoices inv ON inv.id = invoice_items.invoice_id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = inv.employee_id
    )
  );

CREATE POLICY "invoice_items_update_lead" ON invoice_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      JOIN invoices inv ON inv.id = invoice_items.invoice_id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = inv.employee_id
    )
  );

CREATE POLICY "invoice_items_delete_lead" ON invoice_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      JOIN invoices inv ON inv.id = invoice_items.invoice_id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = inv.employee_id
    )
  );


-- ============================================================
-- 9. EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  category TEXT,
  description TEXT NOT NULL,
  amount_uah NUMERIC(10,2),
  amount_usd NUMERIC(10,2),
  exchange_rate NUMERIC(8,4),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read expenses
CREATE POLICY "expenses_select_authenticated" ON expenses
  FOR SELECT TO authenticated
  USING (true);

-- Admin can CRUD all expenses
CREATE POLICY "expenses_insert_admin" ON expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "expenses_update_admin" ON expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "expenses_delete_admin" ON expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Lead can CRUD expenses for their team's invoices
CREATE POLICY "expenses_insert_lead" ON expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      JOIN invoices inv ON inv.id = expenses.invoice_id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = inv.employee_id
    )
  );

CREATE POLICY "expenses_update_lead" ON expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      JOIN invoices inv ON inv.id = expenses.invoice_id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = inv.employee_id
    )
  );

CREATE POLICY "expenses_delete_lead" ON expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      JOIN invoices inv ON inv.id = expenses.invoice_id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = inv.employee_id
    )
  );


-- ============================================================
-- 10. SETTINGS
-- ============================================================
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "settings_select_authenticated" ON settings
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert settings
CREATE POLICY "settings_insert_admin" ON settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can update settings
CREATE POLICY "settings_update_admin" ON settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- 11. MONTH_LOCKS
-- ============================================================
CREATE TABLE month_locks (
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (month, year)
);

ALTER TABLE month_locks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read month locks
CREATE POLICY "month_locks_select_authenticated" ON month_locks
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert month locks
CREATE POLICY "month_locks_insert_admin" ON month_locks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can delete month locks (unlock)
CREATE POLICY "month_locks_delete_admin" ON month_locks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- HELPER FUNCTION: Increment employee invoice number
-- ============================================================
CREATE OR REPLACE FUNCTION increment_invoice_number(emp_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_num INTEGER;
BEGIN
  SELECT next_invoice_number INTO current_num
  FROM employees WHERE id = emp_id FOR UPDATE;

  UPDATE employees
  SET next_invoice_number = current_num + 1
  WHERE id = emp_id;

  RETURN current_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- HELPER FUNCTION: Check if month is locked
-- ============================================================
CREATE OR REPLACE FUNCTION is_month_locked(p_month INTEGER, p_year INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM month_locks
    WHERE month = p_month AND year = p_year
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_timesheets_employee ON timesheets(employee_id);
CREATE INDEX idx_timesheets_period ON timesheets(month, year);
CREATE INDEX idx_timesheets_employee_period ON timesheets(employee_id, month, year);
CREATE INDEX idx_invoices_employee ON invoices(employee_id);
CREATE INDEX idx_invoices_period ON invoices(month, year);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_expenses_invoice ON expenses(invoice_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_employee ON team_members(employee_id);
CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_active ON projects(is_active);


-- ============================================================
-- SEED DATA: Projects
-- ============================================================
INSERT INTO projects (name, code, company) VALUES
  ('Spectre', 'SPECTR', 'OMD'),
  ('Fury', 'FURY', 'WS'),
  ('Kestrel', 'KESTREL', 'OMD'),
  ('RATO Booster', 'RATO_BOOSTER', 'OMD'),
  ('Motors', 'MOTORS', 'WS'),
  ('Batteries', 'BATTERIES', 'OM_ENERGY_UA'),
  ('Other', 'OTHER', 'WS');


-- ============================================================
-- SEED DATA: Settings
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('billed_to', '{"name":"Woodenshark LLC","address":"3411 Silverside Road, Suite 104, Rodney Building, Wilmington, Delaware 19810, USA"}'::jsonb),
  ('payment_terms', '{"text":"Thank you for your business! Please make the payment within 14 days. There will be a 4% interest charge per month on late invoices.","due_days":14}'::jsonb),
  ('uah_usd_rate', '{"rate":42.16,"updated":"2026-03-01"}'::jsonb),
  ('working_hours_adjustment', '{"subtract_hours":8}'::jsonb),
  ('email_admin', '{"email":"","name":"Email Admin"}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 12. EMPLOYEES — Additional columns for contracts & email
-- ============================================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'Contractor'
  CHECK (contract_type IN ('Full-Time', 'Part-Time', 'Contractor'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_uploaded_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nda_uploaded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(work_email);


-- ============================================================
-- 13. EMAIL_REQUESTS — Corporate email provisioning workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS email_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'created')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_requests ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read email requests
CREATE POLICY "email_requests_select_authenticated" ON email_requests
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert email requests
CREATE POLICY "email_requests_insert_admin" ON email_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Lead can insert email requests for their team
CREATE POLICY "email_requests_insert_lead" ON email_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN teams t ON t.lead_email = p.email
      JOIN team_members tm ON tm.team_id = t.id
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
        AND tm.employee_id = email_requests.employee_id
    )
  );

-- Admin can update email requests
CREATE POLICY "email_requests_update_admin" ON email_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can delete email requests
CREATE POLICY "email_requests_delete_admin" ON email_requests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_requests_employee ON email_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_email_requests_status ON email_requests(status);


-- ============================================================
-- 14. WORKING_HOURS_CONFIG — Monthly working days/hours config
-- ============================================================
CREATE TABLE IF NOT EXISTS working_hours_config (
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2024 AND 2030),
  working_days INTEGER NOT NULL,
  hours_per_day NUMERIC(4,1) DEFAULT 8.0,
  adjustment_hours NUMERIC(4,1) DEFAULT 0,
  notes TEXT,
  PRIMARY KEY (month, year)
);

ALTER TABLE working_hours_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read working hours config
CREATE POLICY "working_hours_config_select_authenticated" ON working_hours_config
  FOR SELECT TO authenticated
  USING (true);

-- Admin can insert working hours config
CREATE POLICY "working_hours_config_insert_admin" ON working_hours_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can update working hours config
CREATE POLICY "working_hours_config_update_admin" ON working_hours_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin can delete working hours config
CREATE POLICY "working_hours_config_delete_admin" ON working_hours_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- HELPER FUNCTION: Calculate regular working hours for a month
-- ============================================================
CREATE OR REPLACE FUNCTION get_regular_hours(p_month INTEGER, p_year INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  config_row working_hours_config%ROWTYPE;
  calc_working_days INTEGER := 0;
  d DATE;
BEGIN
  -- Try to get from config table first
  SELECT * INTO config_row
  FROM working_hours_config
  WHERE month = p_month AND year = p_year;

  IF FOUND THEN
    RETURN (config_row.working_days * config_row.hours_per_day) + config_row.adjustment_hours;
  END IF;

  -- Fallback: auto-calculate working days (Mon-Fri)
  d := make_date(p_year, p_month, 1);
  WHILE EXTRACT(MONTH FROM d) = p_month LOOP
    IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
      calc_working_days := calc_working_days + 1;
    END IF;
    d := d + INTERVAL '1 day';
  END LOOP;

  RETURN calc_working_days * 8.0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- TRIGGER: Auto-sync email when email_request status = 'created'
-- ============================================================
CREATE OR REPLACE FUNCTION sync_email_on_request_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'created' AND (OLD.status IS NULL OR OLD.status <> 'created') THEN
    -- Extract email from admin_note if provided, otherwise leave as-is
    IF NEW.admin_note IS NOT NULL AND NEW.admin_note LIKE '%@%' THEN
      UPDATE employees SET work_email = trim(NEW.admin_note)
      WHERE id = NEW.employee_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_email_request_sync
  AFTER UPDATE ON email_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_email_on_request_created();


-- ============================================================
-- STORAGE BUCKETS: contracts and documents
-- ============================================================
-- Note: Storage buckets must be created via Supabase dashboard or API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage RLS policies (applied via Supabase dashboard):
-- contracts bucket: authenticated read, admin upload/delete
-- documents bucket: authenticated read, admin upload/delete
