-- New weekly check-in types: gi_burden, activity_quality, sleep_quality, mental_health
-- The weekly_checkins table uses checkin_type TEXT (not an enum), so no schema
-- changes are required. This migration is a no-op documentation marker.
--
-- New checkin_type values accepted by the app:
--   'gi_burden'        — GI Symptom Burden (unlocks day 1)
--   'activity_quality' — Activity & Strength (unlocks day 8)
--   'sleep_quality'    — Sleep Quality (unlocks day 15)
--   'mental_health'    — Mental Health / PHQ-2+GAD-2 (unlocks day 22)
--
-- Score semantics (all stored as 0–100 normalized):
--   gi_burden:        100 = no symptoms   (inverted raw 0–20)
--   activity_quality: 100 = highly active (direct raw 0–20)
--   sleep_quality:    100 = excellent      (inverted raw 0–20)
--   mental_health:    100 = stable         (inverted raw 0–20)

SELECT 1; -- no-op
