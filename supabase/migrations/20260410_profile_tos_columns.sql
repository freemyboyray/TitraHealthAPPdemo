-- Add TOS / Privacy Policy acceptance tracking columns to profiles.
--
-- Background: an earlier migration file at 20260401_tos_and_username.sql
-- defined these columns alongside a full_name → username rename, but the
-- migration was never applied to the live database. The TypeScript code at
-- contexts/profile-context.tsx writes these columns in the completeOnboarding
-- upsert, so without these columns, every new sign-up's onboarding completion
-- fails silently with PGRST204 (unknown columns) and the user ends up with no
-- profile row. The full_name → username rename is split into a separate
-- migration so it can be paired atomically with code updates.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_version         TEXT,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_version     TEXT;
