-- Free-text medication name captured when user picks "Other" in onboarding,
-- so we can show their drug name throughout the app instead of generic "Other".
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS medication_custom_name TEXT;
