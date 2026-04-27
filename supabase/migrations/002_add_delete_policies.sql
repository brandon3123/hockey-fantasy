CREATE POLICY "Admin can delete invites" ON draft_invites FOR DELETE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

CREATE POLICY "Admin can delete participants" ON draft_participants FOR DELETE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

CREATE POLICY "Admin can delete their drafts" ON drafts FOR DELETE USING (
  admin_user_id = auth.uid()
);
