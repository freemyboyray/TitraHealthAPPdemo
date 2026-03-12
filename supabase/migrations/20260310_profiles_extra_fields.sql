ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sex                    TEXT,
  ADD COLUMN IF NOT EXISTS apple_health_enabled   BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_weekly_loss_lbs NUMERIC,
  ADD COLUMN IF NOT EXISTS activity_level         TEXT     DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS craving_days           JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS initial_side_effects   JSONB    DEFAULT '[]';
