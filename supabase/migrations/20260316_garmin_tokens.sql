-- Add garmin_tokens JSONB column to profiles for storing Garmin OAuth tokens
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS garmin_tokens JSONB DEFAULT NULL;

-- Add source column to activity_logs to track data origin (manual, garmin, apple_health, etc.)
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add source column to weight_logs
ALTER TABLE weight_logs
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Unique constraint for garmin upsert on activity_logs
ALTER TABLE activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_user_date_source_key;
ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_user_date_source_key UNIQUE (user_id, date, source);

-- Unique constraint for garmin upsert on weight_logs
-- Use a partial unique index so only garmin rows are deduplicated by day
CREATE UNIQUE INDEX IF NOT EXISTS weight_logs_garmin_daily_uniq
  ON weight_logs (user_id, source, (logged_at::date))
  WHERE source = 'garmin';
