-- Add treatment_status column to profiles
-- Values: 'on' (actively taking a GLP-1) or 'off' (not on medication)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS treatment_status TEXT NOT NULL DEFAULT 'on';

-- All existing users are on-treatment (they completed medication onboarding)
UPDATE profiles SET treatment_status = 'on' WHERE treatment_status IS NULL;

-- Extend medication_changes change_type constraint to include stopped/resumed
-- First drop the existing constraint, then re-add with new values
ALTER TABLE medication_changes
  DROP CONSTRAINT IF EXISTS medication_changes_change_type_check;

ALTER TABLE medication_changes
  ADD CONSTRAINT medication_changes_change_type_check
  CHECK (change_type IN ('drug_type', 'freq_change', 'brand_swap', 'dose_only', 'stopped', 'resumed'));
