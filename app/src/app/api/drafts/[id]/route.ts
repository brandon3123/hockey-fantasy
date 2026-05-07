import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIsAdmin } from '@/lib/admin';
import { createServerClient } from '@supabase/ssr';

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

  if (!user) {
    return NextResponse.json({ draft, invites: [], participants: [], picks: [], is_admin: false });
  }

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  const [picksResult, invitesResult, participantsResult] = await Promise.all([
    adminClient.from('draft_picks').select('*').eq('draft_id', id).order('created_at', { ascending: true }),
    adminClient.from('draft_invites').select('*').eq('draft_id', id).order('invited_at', { ascending: true }),
    adminClient.from('draft_participants').select('id, team_name, draft_position, has_paid, created_at, user_id').eq('draft_id', id).order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({
    draft,
    invites: invitesResult.data || [],
    participants: participantsResult.data || [],
    picks: picksResult.data || [],
    is_admin: await getIsAdmin(user.id),
  });
}
