DROP POLICY IF EXISTS "Users can view participants of their drafts" ON draft_participants;

CREATE POLICY "Users can view participants of their drafts" ON draft_participants FOR SELECT USING (
  user_id = auth.uid()
  OR draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
