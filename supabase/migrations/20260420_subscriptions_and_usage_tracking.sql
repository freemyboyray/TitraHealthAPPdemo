-- ============================================================================
-- Subscriptions & Usage Tracking for Freemium Model
-- ============================================================================

-- Subscription status tracking
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'none' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired', 'none')),
  plan text NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly', 'annual')),
  provider text NOT NULL CHECK (provider IN ('app_store', 'play_store', 'stripe')),
  provider_subscription_id text,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: users can only view their own subscription
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage subscriptions (for webhook edge function)
CREATE POLICY "Service role manages subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Usage tracking for metered AI features
CREATE TABLE usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  feature_key text NOT NULL CHECK (feature_key IN ('ai_chat', 'photo_analysis', 'voice_log')),
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, feature_key)
);

-- RLS: users can view their own usage
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage usage (for edge functions to increment)
CREATE POLICY "Service role manages usage"
  ON usage_tracking FOR ALL
  USING (auth.role() = 'service_role');

-- Denormalized premium flag on profiles for fast client reads
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Index for fast usage lookups
CREATE INDEX idx_usage_tracking_user_date ON usage_tracking(user_id, date);

-- Index for subscription lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_provider_id ON subscriptions(provider_subscription_id);

-- Helper function: check and increment usage (atomic)
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
  -- Check if user is premium
  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = p_user_id;

  -- Premium users bypass limits
  IF v_is_premium = true THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', null, 'is_premium', true);
  END IF;

  -- Upsert usage record and get current count
  INSERT INTO usage_tracking (user_id, date, feature_key, count)
  VALUES (p_user_id, CURRENT_DATE, p_feature_key, 1)
  ON CONFLICT (user_id, date, feature_key)
  DO UPDATE SET count = usage_tracking.count + 1
  RETURNING count INTO v_current_count;

  -- Check if over limit (we already incremented, so check > limit)
  IF v_current_count > p_limit THEN
    -- Roll back the increment
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
