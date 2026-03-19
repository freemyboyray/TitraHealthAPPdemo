-- Add last_injection_date to profiles so the shot cycle survives app reloads.
-- Nullable — not every user will have a logged injection at signup.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_injection_date TEXT;
