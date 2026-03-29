-- Migration: Standardize van size categories
-- Old values: transit, luton, large_luton, 7.5t
-- New values: swb, mwb, lwb, luton, 7.5t

-- 1. Update drivers CHECK constraint
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_van_size_check;
ALTER TABLE drivers ADD CONSTRAINT drivers_van_size_check
  CHECK (van_size IN ('swb','mwb','lwb','luton','7.5t'));

-- 2. Add van_size column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS van_size text DEFAULT 'luton';
