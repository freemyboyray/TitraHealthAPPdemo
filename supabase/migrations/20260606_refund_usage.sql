-- refund_usage: decrement one previously-charged use of a metered feature.
--
-- The openai-proxy edge function charges a usage credit (via
-- check_and_increment_usage) right before calling OpenAI. When that call fails
-- (e.g. OpenAI returns a 502), the proxy calls this function so the user is not
-- charged a daily credit for an analysis that never produced a result.
--
-- Floored at 0 so a refund can never drive the count negative. Scoped to the
-- caller's own row for the current day + feature only. SECURITY DEFINER because
-- it is invoked by the edge function with the service-role key.
CREATE OR REPLACE FUNCTION public.refund_usage(
  p_user_id uuid,
  p_feature_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE usage_tracking
  SET count = GREATEST(count - 1, 0)
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE
    AND feature_key = p_feature_key;
END;
$function$;

-- Only the service role (edge functions) should refund. Clients must never be
-- able to refund their own usage, or the daily limit becomes unenforceable.
REVOKE ALL ON FUNCTION public.refund_usage(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_usage(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.refund_usage(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_usage(uuid, text) TO service_role;
