-- Constrain dose_mg to realistic clinical values to prevent
-- data skew in peer comparison aggregates.
ALTER TABLE public.profiles
  ADD CONSTRAINT dose_mg_valid
  CHECK (dose_mg IS NULL OR (dose_mg > 0 AND dose_mg <= 100));
