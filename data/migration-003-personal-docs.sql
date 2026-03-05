-- Migration 003: Personal Documents fields for Contract & NDA generation
-- Run this in Supabase SQL Editor

ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS passport_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS passport_issued DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS passport_expires DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS agreement_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS effective_date DATE;
