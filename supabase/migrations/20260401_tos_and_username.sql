-- Rename full_name to username (de-identification for HIPAA avoidance)
ALTER TABLE profiles RENAME COLUMN full_name TO username;

-- Add TOS + Privacy Policy acceptance tracking
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_version         TEXT,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_version     TEXT;
