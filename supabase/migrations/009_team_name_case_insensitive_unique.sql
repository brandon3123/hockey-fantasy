-- Case-insensitive team-name uniqueness: 'Brandon' and 'brandon' must not
-- both seat in one draft. Replaces the case-sensitive constraint from 008.
ALTER TABLE draft_participants DROP CONSTRAINT draft_participants_draft_id_team_name_key;
CREATE UNIQUE INDEX draft_participants_draft_id_team_name_lower_idx
  ON draft_participants (draft_id, LOWER(team_name));
