import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { getIsAdmin } from '@/lib/admin';

/**
 * Bind a name-only roster seat to the admin's account (one-time "this is my
 * team"). Admin-gated: name seats are never claimable by other users.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!await getIsAdmin(user.id)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { participant_id } = await request.json();
  if (!participant_id) {
    return NextResponse.json({ error: 'participant_id required' }, { status: 400 });
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

  const { data: seat } = await adminClient
    .from('draft_participants')
    .select('id, user_id, team_name')
    .eq('id', participant_id)
    .eq('draft_id', id)
    .single();

  if (!seat) {
    return NextResponse.json({ error: 'Seat not found in this draft' }, { status: 404 });
  }

  if (seat.user_id) {
    return NextResponse.json({ error: 'Seat already claimed' }, { status: 400 });
  }

  const { data: existingSeat } = await adminClient
    .from('draft_participants')
    .select('id')
    .eq('draft_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingSeat) {
    return NextResponse.json({ error: 'Already have a seat in this draft' }, { status: 400 });
  }

  const { error } = await adminClient
    .from('draft_participants')
    .update({ user_id: user.id })
    .eq('id', participant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, team_name: seat.team_name });
}
