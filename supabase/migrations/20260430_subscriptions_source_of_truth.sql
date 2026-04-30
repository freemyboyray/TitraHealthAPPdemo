-- ============================================================================
-- Subscriptions as Single Source of Truth
-- ============================================================================
-- Client (stores/subscription-store.ts) now derives premium from
-- subscriptions.status, not profiles.is_premium. This migration aligns the
-- server-side gate (check_and_increment_usage) with that source of truth,
-- adds a 'demo' provider so redeem-demo can write a real subscription row,
-- and backfills existing demo-only premium users.

-- 1. Allow 'demo' as a subscription provider
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IN ('app_store', 'play_store', 'stripe', 'demo'));

-- 2. Backfill demo subscriptions for users who have is_premium=true but no
-- subscription row. ON CONFLICT DO NOTHING preserves any real Stripe/Apple
-- rows that may already exist.
INSERT INTO subscriptions (user_id, status, plan, provider, provider_subscription_id, current_period_end)
SELECT id, 'active', 'monthly', 'demo', 'demo-' || id::text, NULL
FROM profiles
WHERE is_premium = true
ON CONFLICT (user_id) DO NOTHING;

-- 3. Replace check_and_increment_usage to gate on subscriptions.status
-- (mirrors stores/subscription-store.ts loadSubscription logic) instead of
-- profiles.is_premium. trial_ends_at on profiles is still honored for parity.
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_user_id uuid,
  p_feature_key text,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_premium boolean;
  v_current_count integer;
BEGIN
  SELECT
    (s.status = 'active'
     OR s.status = 'trialing'
     OR (s.status = 'canceled' AND s.current_period_end > NOW()))
    OR (p.trial_ends_at IS NOT NULL AND p.trial_ends_at > NOW())
  INTO v_is_premium
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  WHERE p.id = p_user_id;

  v_is_premium := COALESCE(v_is_premium, false);

  IF v_is_premium = true THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', null, 'is_premium', true);
  END IF;

  INSERT INTO usage_tracking (user_id, date, feature_key, count)
  VALUES (p_user_id, CURRENT_DATE, p_feature_key, 1)
  ON CONFLICT (user_id, date, feature_key)
  DO UPDATE SET count = usage_tracking.count + 1
  RETURNING count INTO v_current_count;

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
