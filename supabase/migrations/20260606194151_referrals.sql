-- ============================================================================
-- Referrals: give-a-month / get-a-month
-- ============================================================================
-- A user shares a code. A brand-new user (account < 7 days, no prior paid sub)
-- redeems it. When that referee CONVERTS TO PAID, both the referrer and the
-- referee earn one free month of Titra Pro.
--
-- Why a separate credits table (not the subscriptions table)?
--   subscriptions has UNIQUE(user_id) and both purchase webhooks upsert
--   onConflict:user_id. A paying referrer already owns their app_store row, so a
--   comp row can't coexist there and the Apple webhook would clobber it. Credits
--   therefore live in referral_credits and are OR'd into the two entitlement
--   gates (client subscription-store + check_and_increment_usage).
--
-- iOS reality: we cannot add days to an Apple-managed subscription from the
-- server. So a paying beneficiary's month is BANKED and activated only when
-- their paid coverage actually lapses (subscription-webhook calls
-- activate_banked_credit). We never touch the Apple subscription.
--
-- Reward is granted by ONE trigger on the subscriptions table — the single
-- chokepoint both verify-purchase (app-open) and subscription-webhook
-- (app-closed renewal) write through.

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text UNIQUE NOT NULL,          -- e.g. TITRA-X7K2P9; lookup is case-insensitive
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id   uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, -- a person can be referred once
  code         text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','trialing','qualified','rewarded','void')),
  qualified_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referee_id)
);

CREATE TABLE IF NOT EXISTS public.referral_credits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,           -- beneficiary
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('referrer','referee')),
  status      text NOT NULL DEFAULT 'banked'
              CHECK (status IN ('banked','active','consumed','void')),
  starts_at   timestamptz,                  -- null while banked
  expires_at  timestamptz,                  -- starts_at + 30d once active
  granted_at  timestamptz DEFAULT now(),
  CONSTRAINT referral_credits_unique UNIQUE (referral_id, user_id)   -- one credit per person per referral (idempotency)
);

CREATE INDEX IF NOT EXISTS referral_credits_user_status_idx ON public.referral_credits (user_id, status);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);

-- ─── RLS (mirrors the subscriptions pattern: service_role manages, user reads own) ──

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages referral_codes" ON public.referral_codes;
CREATE POLICY "Service role manages referral_codes" ON public.referral_codes
  FOR ALL TO public USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Users view own referral_code" ON public.referral_codes;
CREATE POLICY "Users view own referral_code" ON public.referral_codes
  FOR SELECT TO public USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages referrals" ON public.referrals;
CREATE POLICY "Service role manages referrals" ON public.referrals
  FOR ALL TO public USING (auth.role() = 'service_role');
-- Referrer sees their own referrals (for the anonymized progress UI). Referee
-- identity is never selected by the client — only status is rendered.
DROP POLICY IF EXISTS "Referrer views own referrals" ON public.referrals;
CREATE POLICY "Referrer views own referrals" ON public.referrals
  FOR SELECT TO public USING ((SELECT auth.uid()) = referrer_id);

DROP POLICY IF EXISTS "Service role manages referral_credits" ON public.referral_credits;
CREATE POLICY "Service role manages referral_credits" ON public.referral_credits
  FOR ALL TO public USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Users view own referral_credits" ON public.referral_credits;
CREATE POLICY "Users view own referral_credits" ON public.referral_credits
  FOR SELECT TO public USING ((SELECT auth.uid()) = user_id);

-- ─── Coverage helper (the same notion of "currently premium" the gates use) ──

CREATE OR REPLACE FUNCTION public.referral_user_has_coverage(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.user_id = p_user_id
        AND (s.status IN ('active','trialing','past_due')
             OR (s.status = 'canceled' AND s.current_period_end > now()))
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = p_user_id AND p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now()
    )
    OR EXISTS (
      SELECT 1 FROM referral_credits rc
      WHERE rc.user_id = p_user_id AND rc.status = 'active' AND rc.expires_at > now()
    );
$$;

-- ─── Grant: activate now if beneficiary is free, else bank for later ─────────

CREATE OR REPLACE FUNCTION public.grant_referral_credit(
  p_referral_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_covered boolean := referral_user_has_coverage(p_user_id);
BEGIN
  INSERT INTO referral_credits (user_id, referral_id, role, status, starts_at, expires_at)
  VALUES (
    p_user_id,
    p_referral_id,
    p_role,
    CASE WHEN v_covered THEN 'banked' ELSE 'active' END,
    CASE WHEN v_covered THEN NULL ELSE now() END,
    CASE WHEN v_covered THEN NULL ELSE now() + interval '30 days' END
  )
  ON CONFLICT (referral_id, user_id) DO NOTHING;   -- idempotent: re-fired conversions are no-ops
END;
$$;

-- ─── Activate a banked credit when paid coverage lapses (called by webhook) ──

CREATE OR REPLACE FUNCTION public.activate_banked_credit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Don't stack: only light up a banked credit when the user has no coverage.
  IF referral_user_has_coverage(p_user_id) THEN
    RETURN;
  END IF;

  SELECT id INTO v_id
  FROM referral_credits
  WHERE user_id = p_user_id AND status = 'banked'
  ORDER BY granted_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE referral_credits
    SET status = 'active', starts_at = now(), expires_at = now() + interval '30 days'
    WHERE id = v_id;

  -- Keep the denormalized flag fresh (cosmetic; gates compute liveness lazily).
  -- Safe under protect_premium_columns: the webhook calls this as service_role.
  UPDATE profiles SET is_premium = true WHERE id = p_user_id;
END;
$$;

-- ─── Clawback: a referee refunds/revokes → void the rewards it produced ──────

CREATE OR REPLACE FUNCTION public.void_referral_credits_for_referee(p_referee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref_id uuid;
BEGIN
  SELECT id INTO v_ref_id FROM referrals WHERE referee_id = p_referee_id;
  IF v_ref_id IS NULL THEN
    RETURN;
  END IF;

  -- Void what isn't yet fully consumed: banked, or active with time remaining.
  -- A window that has already fully elapsed is left alone (we eat the rare case).
  UPDATE referral_credits
    SET status = 'void'
    WHERE referral_id = v_ref_id
      AND (status = 'banked'
           OR (status = 'active' AND (expires_at IS NULL OR expires_at > now())));

  UPDATE referrals SET status = 'void' WHERE id = v_ref_id;
END;
$$;

-- ─── The qualification trigger (single chokepoint on subscriptions) ──────────

CREATE OR REPLACE FUNCTION public.handle_referral_qualification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref referrals%ROWTYPE;
BEGIN
  -- Only real-money providers qualify (ignore demo/comp rows).
  IF NEW.provider NOT IN ('app_store','play_store','stripe') THEN
    RETURN NEW;
  END IF;

  -- Is the row's owner a referee with a live referral?
  SELECT * INTO v_ref FROM referrals WHERE referee_id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- (1) Trial-started signal — powers the referrer's progress UI.
  IF NEW.status = 'trialing' AND v_ref.status = 'pending' THEN
    UPDATE referrals SET status = 'trialing' WHERE id = v_ref.id;
    RETURN NEW;
  END IF;

  -- (2) Qualification on first paid conversion (trialing/none -> active).
  IF NEW.status = 'active'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active')
     AND v_ref.status IN ('pending','trialing') THEN
    UPDATE referrals SET status = 'qualified', qualified_at = now() WHERE id = v_ref.id;

    PERFORM grant_referral_credit(v_ref.id, v_ref.referrer_id, 'referrer');
    PERFORM grant_referral_credit(v_ref.id, v_ref.referee_id,  'referee');

    UPDATE referrals SET status = 'rewarded' WHERE id = v_ref.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Billing safety: referral processing must NEVER block a subscription write.
  -- A bug here degrades to "no reward" (recoverable) instead of breaking purchases.
  RAISE WARNING 'handle_referral_qualification failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referral_qualification_trigger ON public.subscriptions;
CREATE TRIGGER referral_qualification_trigger
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_referral_qualification();

-- ─── User-facing RPC: get (or lazily create) the caller's own referral code ──

CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_code text;
  v_try  int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT code INTO v_code FROM referral_codes WHERE user_id = v_uid;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  LOOP
    v_try := v_try + 1;
    -- TITRA- + 6 unambiguous base32 chars (no 0/O/1/I/L).
    SELECT 'TITRA-' || string_agg(
             substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1), '')
      INTO v_code
      FROM generate_series(1, 6);

    BEGIN
      INSERT INTO referral_codes (user_id, code) VALUES (v_uid, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Either a concurrent call created this user's row, or the code collided.
      SELECT code INTO v_code FROM referral_codes WHERE user_id = v_uid;
      IF v_code IS NOT NULL THEN
        RETURN v_code;
      END IF;
      IF v_try >= 10 THEN
        RAISE;
      END IF;
      -- otherwise loop and try a fresh code
    END;
  END LOOP;
END;
$$;

-- ─── Gate edit: OR an active referral credit into check_and_increment_usage ──
-- Body preserved from 20260505_pro_sanity_limits.sql; adds the credit clause and
-- re-declares SET search_path (CREATE OR REPLACE resets the ALTER from 20260606160858).

CREATE OR REPLACE FUNCTION public.check_and_increment_usage(
  p_user_id uuid,
  p_feature_key text,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium boolean;
  v_current_count integer;
  v_pro_ceiling integer;
BEGIN
  SELECT
    (s.status = 'active'
     OR s.status = 'trialing'
     OR (s.status = 'canceled' AND s.current_period_end > NOW()))
    OR (p.trial_ends_at IS NOT NULL AND p.trial_ends_at > NOW())
    OR EXISTS (
      SELECT 1 FROM referral_credits rc
      WHERE rc.user_id = p.id AND rc.status = 'active' AND rc.expires_at > NOW()
    )
  INTO v_is_premium
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  WHERE p.id = p_user_id;

  v_is_premium := COALESCE(v_is_premium, false);

  -- Increment first, decide after. Same row regardless of tier so we have
  -- a unified picture of usage.
  INSERT INTO usage_tracking (user_id, date, feature_key, count)
  VALUES (p_user_id, CURRENT_DATE, p_feature_key, 1)
  ON CONFLICT (user_id, date, feature_key)
  DO UPDATE SET count = usage_tracking.count + 1
  RETURNING count INTO v_current_count;

  IF v_is_premium THEN
    v_pro_ceiling := CASE p_feature_key
      WHEN 'ai_chat'        THEN 200
      WHEN 'photo_analysis' THEN 100
      WHEN 'voice_log'      THEN 100
      WHEN 'food_parse'     THEN 500
      ELSE 1000
    END;

    IF v_current_count > v_pro_ceiling THEN
      UPDATE usage_tracking
      SET count = count - 1
      WHERE user_id = p_user_id AND date = CURRENT_DATE AND feature_key = p_feature_key;

      RETURN jsonb_build_object(
        'allowed', false,
        'remaining', 0,
        'used', v_current_count - 1,
        'limit', v_pro_ceiling,
        'is_premium', true
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', v_pro_ceiling - v_current_count,
      'used', v_current_count,
      'limit', v_pro_ceiling,
      'is_premium', true
    );
  END IF;

  -- Free user path: enforce caller-supplied limit.
  IF v_current_count > p_limit THEN
    UPDATE usage_tracking
    SET count = count - 1
    WHERE user_id = p_user_id AND date = CURRENT_DATE AND feature_key = p_feature_key;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'used', v_current_count - 1,
      'limit', p_limit,
      'is_premium', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_current_count,
    'used', v_current_count,
    'limit', p_limit,
    'is_premium', false
  );
END;
$$;

-- ─── Function permissions ────────────────────────────────────────────────────
-- Internal functions: service_role only (the trigger runs SECURITY DEFINER, and
-- the webhook calls activate/void as service_role). Keep them off the client.
REVOKE ALL ON FUNCTION public.referral_user_has_coverage(uuid)          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_referral_credit(uuid, uuid, text)   FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_banked_credit(uuid)              FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.void_referral_credits_for_referee(uuid)   FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_user_has_coverage(uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_referral_credit(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_banked_credit(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION public.void_referral_credits_for_referee(uuid) TO service_role;

-- Self-service code generation: authenticated users may mint their own code
-- (the function is scoped to auth.uid()).
REVOKE ALL ON FUNCTION public.get_or_create_referral_code() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated, service_role;

-- check_and_increment_usage stays edge-function-only (revoked in 20260606160154;
-- CREATE OR REPLACE preserves grants, so no re-grant needed).

-- ─── Monitoring (observability, not enforcement) ─────────────────────────────
-- Flags referrers earning rewards quickly. Staff/service-role only.
CREATE OR REPLACE VIEW public.referral_reward_monitor
WITH (security_invoker = true) AS
  SELECT
    user_id,
    count(*)                                                      AS total_credits,
    count(*) FILTER (WHERE status = 'active')                     AS active_credits,
    count(*) FILTER (WHERE status = 'banked')                     AS banked_credits,
    count(*) FILTER (WHERE granted_at > now() - interval '7 days') AS credits_last_7d,
    max(granted_at)                                               AS last_granted_at
  FROM public.referral_credits
  WHERE role = 'referrer'
  GROUP BY user_id;

REVOKE ALL ON public.referral_reward_monitor FROM anon, authenticated, public;
