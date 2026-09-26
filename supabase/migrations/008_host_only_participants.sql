-- Host-only roster drafts: participants may exist without user accounts.
ALTER TABLE draft_participants ALTER COLUMN user_id DROP NOT NULL;

-- One seat per team name per draft (replaces per-user uniqueness).
ALTER TABLE draft_participants DROP CONSTRAINT draft_participants_draft_id_user_id_key;
ALTER TABLE draft_participants ADD CONSTRAINT draft_participants_draft_id_team_name_key UNIQUE (draft_id, team_name);

CREATE INDEX draft_participants_draft_id_position_idx
  ON draft_participants (draft_id, draft_position);

ALTER TABLE drafts ADD COLUMN participant_mode TEXT NOT NULL DEFAULT 'invite'
  CHECK (participant_mode IN ('invite', 'roster'));
