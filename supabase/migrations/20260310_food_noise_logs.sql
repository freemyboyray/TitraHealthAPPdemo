-- Migration: food_noise_logs + dismissed_flags + hair_loss enum value

-- New table for weekly Food Noise Questionnaire (FNQ) scores
CREATE TABLE IF NOT EXISTS food_noise_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score        SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 20),
  q1 SMALLINT NOT NULL CHECK (q1 BETWEEN 0 AND 4),
  q2 SMALLINT NOT NULL CHECK (q2 BETWEEN 0 AND 4),
  q3 SMALLINT NOT NULL CHECK (q3 BETWEEN 0 AND 4),
  q4 SMALLINT NOT NULL CHECK (q4 BETWEEN 0 AND 4),
  q5 SMALLINT NOT NULL CHECK (q5 BETWEEN 0 AND 4),
  program_week SMALLINT,
  phase_at_log phase_type,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE food_noise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own food noise logs"
  ON food_noise_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add hair_loss to side_effect_type enum if not already present
ALTER TYPE side_effect_type ADD VALUE IF NOT EXISTS 'hair_loss';

-- For dismissed clinical flags persistence
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dismissed_flags JSONB DEFAULT '[]';
