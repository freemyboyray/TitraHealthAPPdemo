-- Rename profiles.full_name → profiles.username
--
-- Background: an earlier 20260401_tos_and_username.sql migration intended this
-- rename but was never applied. Sign-in code at app/auth/sign-in.tsx already
-- writes username (the upsert was failing silently with PGRST204 because the
-- column didn't exist). All other code that reads/writes the column has been
-- updated in the same change set as this migration. The rename is non-destructive:
-- existing values are preserved (e.g. "John Smith" stays "John Smith"), only the
-- column name changes. Any consumers still reading full_name will start failing
-- immediately, which is intentional — better than silent data loss.

ALTER TABLE profiles RENAME COLUMN full_name TO username;
