-- ─── Clinicians table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinicians (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  practice_name TEXT,
  npi           TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinicians_code_active_idx
  ON public.clinicians (code) WHERE active = true;

ALTER TABLE public.clinicians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinicians_select_authenticated ON public.clinicians;
CREATE POLICY clinicians_select_authenticated
  ON public.clinicians
  FOR SELECT
  TO authenticated
  USING (active = true);

-- ─── Profiles RTM columns ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rtm_enabled      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rtm_clinician_id UUID REFERENCES public.clinicians(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rtm_linked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rtm_consent_text TEXT;

-- ─── Engagement-days RPC ────────────────────────────────────────────────────
-- Counts distinct calendar dates within [p_start, p_end] on which a user
-- actively logged at least one piece of NON-physiological data. Excludes
-- HealthKit-synced rows (food_logs.source='mfp_sync', activity_logs.source<>'manual').
CREATE OR REPLACE FUNCTION public.rtm_engagement_days(
  p_user_id UUID,
  p_start   DATE,
  p_end     DATE
) RETURNS INT
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COUNT(DISTINCT d)::INT FROM (
    SELECT (logged_at AT TIME ZONE 'UTC')::date AS d
      FROM public.weight_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
    UNION
    SELECT injection_date::date
      FROM public.injection_logs
      WHERE user_id = p_user_id
        AND injection_date::date BETWEEN p_start AND p_end
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.food_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
        AND (source IS NULL OR source <> 'mfp_sync')
    UNION
    SELECT date::date
      FROM public.activity_logs
      WHERE user_id = p_user_id
        AND date::date BETWEEN p_start AND p_end
        AND (source IS NULL OR source = 'manual')
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.side_effect_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.food_noise_logs
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
    UNION
    SELECT (logged_at AT TIME ZONE 'UTC')::date
      FROM public.weekly_checkins
      WHERE user_id = p_user_id
        AND (logged_at AT TIME ZONE 'UTC')::date BETWEEN p_start AND p_end
  ) all_logs;
$$;

GRANT EXECUTE ON FUNCTION public.rtm_engagement_days(UUID, DATE, DATE) TO authenticated;
