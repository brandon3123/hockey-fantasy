CREATE INDEX IF NOT EXISTS idx_player_scores_draft_date ON player_scores(draft_id, score_date);
CREATE INDEX IF NOT EXISTS idx_player_scores_player_draft ON player_scores(player_id, draft_id);
