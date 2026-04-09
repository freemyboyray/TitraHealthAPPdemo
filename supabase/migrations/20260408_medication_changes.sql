-- Medication change history log
-- Records each treatment change so the app can provide contextual guidance
-- (e.g. "You're 2 weeks into your new dose — nausea is expected to subside soon")
CREATE TABLE IF NOT EXISTS medication_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- What changed
  change_type TEXT NOT NULL CHECK (change_type IN ('drug_type', 'freq_change', 'brand_swap', 'dose_only')),

  -- Previous values
  prev_brand TEXT,
  prev_glp1_type TEXT,
  prev_dose_mg REAL,
  prev_frequency_days INTEGER,

  -- New values
  new_brand TEXT NOT NULL,
  new_glp1_type TEXT NOT NULL,
  new_dose_mg REAL NOT NULL,
  new_frequency_days INTEGER NOT NULL,

  -- Context from confirmation flow
  last_dose_date DATE,       -- when user last took old medication
  first_dose_date DATE,      -- when user will start new medication (drug_type switches)
  dose_start_date DATE       -- effective start date of new regimen
);

-- RLS
ALTER TABLE medication_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own medication changes"
  ON medication_changes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medication changes"
  ON medication_changes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for querying recent changes
CREATE INDEX idx_medication_changes_user_date
  ON medication_changes (user_id, changed_at DESC);
