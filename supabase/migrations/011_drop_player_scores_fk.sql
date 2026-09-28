-- Team picks score into player_scores with ids like 'team-edm', but the FK
-- to players(id) rejected them (teams aren't players). The column is TEXT
-- and every reader falls back to the pick's own name, so the FK adds no
-- safety we need — draft_picks.player_id has never had one.
ALTER TABLE player_scores DROP CONSTRAINT player_scores_player_id_fkey;
