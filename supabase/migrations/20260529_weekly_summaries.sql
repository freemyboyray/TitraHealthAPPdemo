-- Weekly summaries: persisted snapshots of computeWeeklySummary + generateWeeklyInsight output.
-- Lets the user re-open the current week's recap and browse past weeks.
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start DATE NOT NULL,
  window_end   DATE NOT NULL,
  summary_data JSONB NOT NULL,
  ai_insight   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, window_end)
);

CREATE INDEX ON weekly_summaries (user_id, window_end DESC);

ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own weekly_summaries"
  ON weekly_summaries FOR ALL
  USING (auth.uid() = user_id);
