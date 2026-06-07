-- Follow-up to 20260606194151_referrals.sql.
-- The qualification trigger function is fired by the trigger only; it must never
-- be callable as an RPC. Trigger functions get default PUBLIC execute — revoke it.
-- (Flagged by the security advisor: anon/authenticated_security_definer_function_executable.)
-- Applied to remote 2026-06-06 via MCP; captured here for source-control parity
-- (version matches remote migration history).
REVOKE ALL ON FUNCTION public.handle_referral_qualification() FROM public, anon, authenticated;
