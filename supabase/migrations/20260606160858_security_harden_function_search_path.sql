-- Security review hardening (items 4-5, safe subset). Applied to remote 2026-06-06
-- via MCP; captured here for source-control parity (version matches remote history).
--
-- Pin search_path on SECURITY DEFINER / flagged functions (prevents search-path
-- hijack). Pinned to 'public' because several bodies reference public tables by
-- unqualified name; anon/authenticated have no CREATE on public in Supabase, so
-- public cannot be poisoned. pg_catalog is always implicitly resolved first.
alter function public.audit_profile_changes()                              set search_path = public;
alter function public.handle_new_user()                                    set search_path = public;
alter function public.protect_premium_columns()                            set search_path = public;
alter function public.set_updated_at()                                     set search_path = public;
alter function public.rtm_engagement_days(uuid, date, date)                set search_path = public;
alter function public.check_and_increment_usage(uuid, text, integer)       set search_path = public;
alter function public.check_rate_limit(text, text, integer, integer)       set search_path = public;
alter function public.refund_usage(uuid, text)                             set search_path = public;

-- Trigger functions should never be reachable as REST RPCs. Triggers still fire
-- (they run as part of the table operation, independent of EXECUTE grants).
revoke execute on function public.audit_profile_changes()   from public, anon, authenticated;
revoke execute on function public.handle_new_user()         from public, anon, authenticated;
revoke execute on function public.protect_premium_columns() from public, anon, authenticated;
revoke execute on function public.set_updated_at()          from public, anon, authenticated;
