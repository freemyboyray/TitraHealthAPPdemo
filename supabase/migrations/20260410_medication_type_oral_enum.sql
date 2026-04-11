-- Expand the medication_type enum to match the TypeScript Glp1Type union.
--
-- Background: constants/user-profile.ts defines Glp1Type with 6 values:
--   semaglutide, tirzepatide, liraglutide, dulaglutide, oral_semaglutide, orforglipron
-- but the original schema only created the enum with the first 3.
-- Result: any attempt to save Trulicity (dulaglutide), Rybelsus / Oral Wegovy
-- (oral_semaglutide), or Orforglipron triggered an enum constraint violation
-- in profiles.medication_type, silently rejecting the entire UPDATE in
-- updateProfile() and leaving users stuck on their previous medication.
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is non-destructive and idempotent.

ALTER TYPE medication_type ADD VALUE IF NOT EXISTS 'dulaglutide';
ALTER TYPE medication_type ADD VALUE IF NOT EXISTS 'oral_semaglutide';
ALTER TYPE medication_type ADD VALUE IF NOT EXISTS 'orforglipron';
