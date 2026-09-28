ALTER TABLE drafts
  ADD COLUMN d_goal_bonus BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN team_picks_enabled BOOLEAN NOT NULL DEFAULT false;
