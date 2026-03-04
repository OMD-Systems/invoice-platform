-- ============================================================
-- Migration 011: DB Audit Fixes
-- 1. Add missing expense_date column to expenses
-- 2. Add missing indexes for common query patterns
-- 3. Add expense_date column (used by upsertExpense in db.js)
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Add expense_date column to expenses (used in db.js but missing from schema)
-- ────────────────────────────────────────────────────────────
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE;

-- ────────────────────────────────────────────────────────────
-- 2. Additional indexes for query performance
-- ────────────────────────────────────────────────────────────

-- teams.lead_email is used in many RLS policies and getTeam/getTeamEmployees queries
CREATE INDEX IF NOT EXISTS idx_teams_lead_email ON teams(lead_email);

-- invoices composite for getInvoices filters + generateInvoice duplicate check
CREATE INDEX IF NOT EXISTS idx_invoices_employee_period_format
  ON invoices(employee_id, month, year, format_type);

-- profiles.email used in getUserRole fallback query
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- employees.email used in RLS policies (migration-005)
CREATE INDEX IF NOT EXISTS idx_employees_personal_email ON employees(email);

-- timesheets.created_by for potential audit queries
CREATE INDEX IF NOT EXISTS idx_timesheets_created_by ON timesheets(created_by);

COMMIT;
