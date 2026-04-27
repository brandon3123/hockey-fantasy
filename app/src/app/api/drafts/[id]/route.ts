import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: draft, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const { data: picks } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('draft_id', id)
    .order('created_at', { ascending: true });

  if (!user) {
    return NextResponse.json({ draft, invites: [], participants: [], picks: picks || [], is_admin: false });
  }

  const { data: invites } = await supabase
    .from('draft_invites')
    .select('*')
    .eq('draft_id', id)
    .order('invited_at', { ascending: true });

  const { data: participants } = await supabase
    .from('draft_participants')
    .select('id, team_name, draft_position, has_paid, created_at, user_id')
    .eq('draft_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    draft,
    invites: invites || [],
    participants: participants || [],
    picks: picks || [],
    is_admin: draft.admin_user_id === user.id,
  });
}
