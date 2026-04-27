ALTER TABLE drafts ADD COLUMN IF NOT EXISTS pick_entry_mode TEXT NOT NULL DEFAULT 'admin_only'
  CHECK (pick_entry_mode IN ('admin_only', 'self_draft'));
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS pick_timer_seconds INTEGER;

ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;
