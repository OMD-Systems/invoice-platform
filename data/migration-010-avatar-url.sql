-- Migration 010: Add avatar_url to employees
-- Allows storing a link to employee's avatar image

ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
