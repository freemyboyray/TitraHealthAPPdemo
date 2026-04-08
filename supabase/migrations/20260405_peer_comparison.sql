-- ─── Peer Comparison: opt-in columns on profiles ─────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS peer_comparison_opted_in boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS peer_comparison_opted_in_at timestamptz;

-- ─── Materialized View: anonymized weight-loss metrics per opted-in user ─────
-- No user_id column — fully anonymized. Only includes opted-in users.

CREATE MATERIALIZED VIEW IF NOT EXISTS user_weight_loss_metrics AS
SELECT
  -- Map medication_brand → generic molecule name
  CASE p.medication_brand
    WHEN 'ozempic'                THEN 'semaglutide'
    WHEN 'wegovy'                 THEN 'semaglutide'
    WHEN 'compounded_semaglutide' THEN 'semaglutide'
    WHEN 'zepbound'               THEN 'tirzepatide'
    WHEN 'mounjaro'               THEN 'tirzepatide'
    WHEN 'compounded_tirzepatide' THEN 'tirzepatide'
    WHEN 'trulicity'              THEN 'dulaglutide'
    WHEN 'saxenda'                THEN 'liraglutide'
    WHEN 'victoza'                THEN 'liraglutide'
    WHEN 'compounded_liraglutide' THEN 'liraglutide'
    WHEN 'rybelsus'               THEN 'oral_semaglutide'
    WHEN 'oral_wegovy'            THEN 'oral_semaglutide'
    WHEN 'orforglipron'           THEN 'orforglipron'
    ELSE 'other'
  END AS medication_name,

  -- Dose tier bucketing (mg)
  CASE
    WHEN p.dose_mg <= 0.375 THEN 0.25
    WHEN p.dose_mg <= 0.75  THEN 0.5
    WHEN p.dose_mg <= 1.5   THEN 1.0
    WHEN p.dose_mg <= 2.2   THEN 2.0
    WHEN p.dose_mg <= 3.5   THEN 2.4
    WHEN p.dose_mg <= 6.25  THEN 5.0
    WHEN p.dose_mg <= 8.75  THEN 7.5
    WHEN p.dose_mg <= 11.25 THEN 10.0
    WHEN p.dose_mg <= 13.75 THEN 12.5
    ELSE 15.0
  END AS dose_tier,

  -- Treatment week bucket
  CASE
    WHEN EXTRACT(DAY FROM now() - p.program_start_date::timestamp) / 7 <= 6  THEN 4
    WHEN EXTRACT(DAY FROM now() - p.program_start_date::timestamp) / 7 <= 10 THEN 8
    WHEN EXTRACT(DAY FROM now() - p.program_start_date::timestamp) / 7 <= 16 THEN 12
    WHEN EXTRACT(DAY FROM now() - p.program_start_date::timestamp) / 7 <= 24 THEN 20
    WHEN EXTRACT(DAY FROM now() - p.program_start_date::timestamp) / 7 <= 32 THEN 28
    WHEN EXTRACT(DAY FROM now() - p.program_start_date::timestamp) / 7 <= 44 THEN 36
    ELSE 52
  END AS treatment_week_bucket,

  -- Weight loss percentage
  ROUND(((p.start_weight_lbs - lw.latest_weight) / p.start_weight_lbs * 100)::numeric, 1) AS weight_loss_pct

FROM profiles p
JOIN LATERAL (
  SELECT weight_lbs AS latest_weight
  FROM weight_logs wl
  WHERE wl.user_id = p.id
  ORDER BY wl.logged_at DESC LIMIT 1
) lw ON true
WHERE p.peer_comparison_opted_in = true
  AND p.start_weight_lbs IS NOT NULL
  AND p.start_weight_lbs > 0
  AND p.program_start_date IS NOT NULL
  AND p.medication_brand IS NOT NULL
  AND p.dose_mg IS NOT NULL;

-- Create unique index for CONCURRENTLY refresh support
CREATE UNIQUE INDEX IF NOT EXISTS uwlm_unique_idx
  ON user_weight_loss_metrics (medication_name, dose_tier, treatment_week_bucket, weight_loss_pct);

-- ─── Summary View: aggregated percentiles per cohort ─────────────────────────
-- Only exposes p25/p50/p75 + count — no individual data.

CREATE OR REPLACE VIEW peer_weight_loss_summary AS
SELECT
  medication_name,
  dose_tier,
  treatment_week_bucket,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY weight_loss_pct) AS p25,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY weight_loss_pct) AS p50,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY weight_loss_pct) AS p75,
  COUNT(*) AS cohort_size
FROM user_weight_loss_metrics
GROUP BY medication_name, dose_tier, treatment_week_bucket;

-- ─── Permissions ─────────────────────────────────────────────────────────────
-- Materialized view: no direct access
REVOKE ALL ON user_weight_loss_metrics FROM anon, authenticated;

-- Summary view: read-only for authenticated users
GRANT SELECT ON peer_weight_loss_summary TO authenticated;
