# Migration Drift Audit — Titra Health Mobile (prod `deywjhyaztodwbeahzqs`)

Date: 2026-06-06. Method: **read-only** introspection of production catalogs
(`information_schema` / `pg_catalog`) compared against local `supabase/migrations/*.sql`.
Nothing in production was modified. This file is a report only.

## Verdict
The local migration files are **NOT a complete record** of the production schema.
A branch (or `supabase db reset`) replays these files, so it would build a BROKEN
schema missing foundational tables (`profiles`, `food_logs`, etc.) that nearly every
other table's foreign keys point at. **Do not branch from the current files.**
Reconcile by baselining from production first (`supabase db pull`).

## Production has 37 public tables
activity_logs, articles, audit_log, auth_rate_limits, chat_messages, clinicians,
courses, daily_article_schedule, demo_codes, doctor_codes, feedback, food_entries,
food_logs, food_noise_logs, injection_logs, integrations, journal_entries,
lesson_progress, lessons, medication_changes, mindfulness_sessions, openai_error_log,
profiles, progress_photos, side_effect_logs, subscriptions, usage_tracking,
user_custom_foods, user_food_preferences, user_goals, user_medications,
user_saved_meal_items, user_saved_meals, webhook_events, weekly_checkins,
weekly_summaries, weight_logs

## Local migration files CREATE only 22 tables
activity_logs, articles, courses, energy_logs, food_entries, food_noise_logs,
injection_logs, journal_entries, lesson_progress, lessons, medication_changes,
mindfulness_sessions, side_effect_logs, subscriptions, usage_tracking,
user_custom_foods, user_food_preferences, user_saved_meal_items, user_saved_meals,
weekly_checkins, weekly_summaries, weight_logs

## Drift A — in PROD but NO local CREATE TABLE (16 tables, created out-of-band)
These were applied directly via the MCP tool or dashboard, never written to a file:
- profiles                ⚠️ CORE — FK target for ~every user table
- food_logs               ⚠️ CORE — primary food logging table
- integrations
- chat_messages
- audit_log
- clinicians
- daily_article_schedule
- demo_codes
- doctor_codes
- feedback
- openai_error_log
- progress_photos
- user_goals
- user_medications
- auth_rate_limits
- webhook_events

## Drift B — in LOCAL files but NOT in prod (1 table)
- energy_logs  (migration `20260511_energy_logs.sql` was never applied to prod, or the table was later dropped)

## Migration-history mismatch (from list_migrations vs files)
- Prod's recorded history starts at `20260428…` (24 entries); ~27 local files predate it with no history entry.
- 20 prod migrations have no local file; even name-matching ones differ in version format
  (files use 8-digit `20260606`, prod uses 14-digit `20260606034549`).

## Recommended reconciliation (prod = source of truth; all reversible via git)
1. `supabase db pull`  → writes ONE baseline migration capturing prod exactly (read-only on prod).
2. Move the 33 existing files into `supabase/migrations/archive/` (kept in git for history).
3. `supabase migration repair` → align the migration tracking table (bookkeeping only, no schema/data change).
4. Confirm `supabase db diff` / `db push` shows NOTHING to push (proves local == prod).
5. Decide on `energy_logs`: drop the stale local file, or intentionally apply it.
6. THEN enable branching. From here: every change = a committed file via `db push`. Never MCP/dashboard DDL on prod.
