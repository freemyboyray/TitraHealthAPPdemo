-- Add medication brand + route + status + unit system + initial dose + dose start date
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS medication_brand         TEXT,
  ADD COLUMN IF NOT EXISTS route_of_administration  TEXT,
  ADD COLUMN IF NOT EXISTS glp1_status              TEXT,
  ADD COLUMN IF NOT EXISTS unit_system              TEXT DEFAULT 'imperial',
  ADD COLUMN IF NOT EXISTS initial_dose_mg          NUMERIC,
  ADD COLUMN IF NOT EXISTS dose_start_date          DATE;
