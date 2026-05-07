import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { getIsAdmin } from '@/lib/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: picks } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('draft_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ picks: picks || [] });
}

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

  const { data: draft, error: draftError } = await supabase
    .from('drafts')
    .select('id, status, current_round, current_pick, players_per_team, pick_entry_mode')
    .eq('id', id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.status !== 'in_progress') {
    return NextResponse.json({ error: 'Draft is not in progress' }, { status: 400 });
  }

  const body = await request.json();
  const { participant_id, player_id, player_name } = body;

  if (!participant_id || !player_id) {
    return NextResponse.json({ error: 'participant_id and player_id required' }, { status: 400 });
  }

  const { data: existingPick } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('draft_id', id)
    .eq('player_id', player_id)
    .maybeSingle();

  if (existingPick) {
    return NextResponse.json({ error: 'Player already drafted' }, { status: 409 });
  }

  const isAdmin = await getIsAdmin(user.id);

  if (draft.pick_entry_mode === 'admin_only' && !isAdmin) {
    return NextResponse.json({ error: 'Only admin can make picks in admin_only mode' }, { status: 403 });
  }

  const { data: participant } = await supabase
    .from('draft_participants')
    .select('id, user_id, draft_position')
    .eq('id', participant_id)
    .eq('draft_id', id)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  if (!isAdmin && participant.user_id !== user.id) {
    return NextResponse.json({ error: 'Not your pick' }, { status: 403 });
  }

  const { data: allParticipants } = await supabase
    .from('draft_participants')
    .select('id, draft_position')
    .eq('draft_id', id)
    .order('draft_position', { ascending: true });

  const managers = allParticipants?.length || 0;
  if (managers === 0) {
    return NextResponse.json({ error: 'No participants' }, { status: 400 });
  }

  const round = draft.current_round;
  const pick = draft.current_pick;

  const isReversed = round % 2 === 0;
  const expectedPosition = isReversed
    ? managers - pick + 1
    : pick;

  if (participant.draft_position !== expectedPosition) {
    return NextResponse.json({ error: 'Not your turn' }, { status: 400 });
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

  const pickNumber = (round - 1) * managers + pick;

  const { error: insertError } = await adminClient
    .from('draft_picks')
    .insert({
      draft_id: id,
      round,
      pick_number: pickNumber,
      participant_id,
      player_id,
      player_name: player_name || null,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const totalPicks = (round - 1) * managers + pick;
  const maxPicks = managers * draft.players_per_team;

  if (totalPicks >= maxPicks) {
    const { error: completeError } = await adminClient
      .from('drafts')
      .update({ status: 'complete' })
      .eq('id', id);

    if (completeError) {
      return NextResponse.json({ error: completeError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, draft_complete: true });
  }

  let nextRound = round;
  let nextPick = pick + 1;

  if (nextPick > managers) {
    nextRound = round + 1;
    nextPick = 1;
  }

  const { error: advanceError } = await adminClient
    .from('drafts')
    .update({ current_round: nextRound, current_pick: nextPick })
    .eq('id', id);

  if (advanceError) {
    return NextResponse.json({ error: advanceError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, draft_complete: false });
}
