CREATE TABLE cron_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  games_found INTEGER DEFAULT 0,
  results_found INTEGER DEFAULT 0,
  scores_upserted INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  score_details JSONB DEFAULT '{}',
  ran_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view cron runs" ON cron_runs FOR SELECT USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Service role can insert cron runs" ON cron_runs FOR INSERT WITH CHECK (true);
