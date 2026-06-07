-- Security review fixes (criticals 1-3). Applied to remote 2026-06-06 via MCP;
-- captured here for source-control parity (version matches remote migration history).
--
-- 1) feedback_dashboard: staff/service-role only. Stop anon + authenticated reads,
--    and make it respect RLS (security_invoker) so it can never bypass feedback RLS
--    even if a grant reappears. Service role still sees everything (RLS bypass).
revoke all on public.feedback_dashboard from anon, authenticated;
alter view public.feedback_dashboard set (security_invoker = true);

-- 2) peer_weight_loss_summary: authenticated-only, with a k-anonymity floor so a
--    cohort of one user can no longer expose that user's exact weight-loss %.
--    Keeps owner-privilege semantics (the feature needs to aggregate across all
--    opted-in users); only the safe k>=5 aggregates are returned. The per-row
--    user_weight_loss_metrics view remains ungranted to anon/authenticated.
create or replace view public.peer_weight_loss_summary as
  select
    medication_name,
    dose_tier,
    treatment_week_bucket,
    percentile_cont(0.25::double precision) within group (order by (weight_loss_pct::double precision)) as p25,
    percentile_cont(0.50::double precision) within group (order by (weight_loss_pct::double precision)) as p50,
    percentile_cont(0.75::double precision) within group (order by (weight_loss_pct::double precision)) as p75,
    count(*) as cohort_size
  from user_weight_loss_metrics
  group by medication_name, dose_tier, treatment_week_bucket
  having count(*) >= 5;

revoke all on public.peer_weight_loss_summary from anon, authenticated, public;
grant select on public.peer_weight_loss_summary to authenticated;

-- 3) Metered/rate-limit RPCs are only ever invoked by edge functions via the
--    service role. Remove direct client reachability (prevents quota griefing of
--    other users + premium-status disclosure via /rest/v1/rpc).
revoke execute on function public.check_and_increment_usage(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
