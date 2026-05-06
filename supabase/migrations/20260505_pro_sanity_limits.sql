-- ============================================================================
-- Pro/Trial Sanity Limits on AI Usage
-- ============================================================================
-- Premium users had no daily ceiling, so a leaked account or runaway client
-- could rack up unbounded OpenAI spend. This sets a high per-feature daily
-- ceiling for premium users (well above any realistic human usage) while
-- leaving free-user limits untouched.
--
-- Pro ceilings (per user, per day):
--   ai_chat         200    (~$0.50/day max @ gpt-4o-mini)
--   photo_analysis  100    (vision is the costly path, ~$5/day max)
--   voice_log       100    (whisper @ ~$0.006/min)
--   food_parse      500    (cheap text parses, but cap the runaway case)
--
-- Premium users now also get tracked in usage_tracking so we can monitor for
-- abuse patterns. Free-user behavior is unchanged.

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
  v_pro_ceiling integer;
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
