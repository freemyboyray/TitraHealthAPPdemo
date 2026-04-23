-- ============================================================================
-- Security Hardening: Protect is_premium from client-side updates
-- ============================================================================
-- Blocks direct client updates to is_premium and trial_ends_at on profiles.
-- Only the service_role (used by webhook edge functions) can modify these.
-- Tables chat_messages, user_goals, food_logs already have RLS enabled.
-- check_rate_limit RPC already exists.

CREATE OR REPLACE FUNCTION protect_premium_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow service_role to update anything (webhooks use this)
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular users, prevent changing subscription-related columns
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    RAISE EXCEPTION 'Cannot modify is_premium directly — managed by subscription webhooks';
  END IF;

  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Cannot modify trial_ends_at directly — managed by subscription webhooks';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_premium_columns_trigger ON profiles;
CREATE TRIGGER protect_premium_columns_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_premium_columns();
