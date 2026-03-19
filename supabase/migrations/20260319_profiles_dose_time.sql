-- Add dose_time to profiles for daily drug users.
-- Stores HH:MM string (e.g. "08:00") indicating the daily dose time.
-- Only relevant for injection_frequency_days = 1 drugs; NULL for weekly injectables.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dose_time TEXT;
