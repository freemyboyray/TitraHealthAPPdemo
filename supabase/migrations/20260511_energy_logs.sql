-- Energy logs: daily self-reported energy level tracking (1-5 scale)
CREATE TABLE IF NOT EXISTS energy_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  level        SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  time_slot    TEXT NOT NULL DEFAULT 'anytime'
               CHECK (time_slot IN ('morning','afternoon','evening','anytime')),
  note         TEXT,
  phase_at_log TEXT,
  program_week INTEGER
);

CREATE INDEX ON energy_logs (user_id, logged_at DESC);

ALTER TABLE energy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own energy_logs"
  ON energy_logs FOR ALL
  USING (auth.uid() = user_id);
