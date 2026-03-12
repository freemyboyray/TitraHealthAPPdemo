CREATE TABLE IF NOT EXISTS weekly_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_type  TEXT NOT NULL,        -- 'energy_mood' | 'appetite'
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  score         INTEGER NOT NULL,    -- 0–100 normalized
  answers       JSONB NOT NULL DEFAULT '{}',
  program_week  INTEGER,
  phase_at_log  TEXT
);

CREATE INDEX ON weekly_checkins (user_id, checkin_type, logged_at DESC);

ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own checkins" ON weekly_checkins
  FOR ALL USING (auth.uid() = user_id);
