-- Prevent duplicate Apple Health / Health Connect weight syncs.
--
-- The HealthKit weight sync runs on both a 60s poll and on screen focus. Under a
-- race, two overlapping calls read the same stale in-memory "latest log" and each
-- insert the same sample, producing exact-duplicate rows (same user, timestamp,
-- and weight). The app-side fix is a re-entrancy guard + pre-insert DB check; this
-- migration is the durable backstop that makes the duplicate physically
-- impossible at the database level.
--
-- NOTE: not yet pushed as of 2026-06-07 because the remote has migration drift
-- (see project memory). Apply during the next reconciled `supabase db push`.

-- 1. Remove any existing exact-duplicate rows, keeping the lowest id per group.
--    Idempotent: a no-op once the data is clean.
delete from public.weight_logs a
using public.weight_logs b
where a.user_id = b.user_id
  and a.logged_at = b.logged_at
  and a.weight_lbs = b.weight_lbs
  and a.id > b.id;

-- 2. Reject future exact duplicates (same user, same timestamp, same weight).
--    Distinct readings always differ in timestamp (manual logs use now(); HK uses
--    the sample's recordedAt), so this never blocks a legitimate entry.
create unique index if not exists weight_logs_user_logged_weight_uniq
  on public.weight_logs (user_id, logged_at, weight_lbs);
