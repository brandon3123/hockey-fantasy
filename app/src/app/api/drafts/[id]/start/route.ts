import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

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
    .select('id, admin_user_id, status, players_per_team')
    .eq('id', id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  if (draft.status === 'in_progress') {
    return NextResponse.json({ error: 'Draft already in progress' }, { status: 400 });
  }

  if (draft.status === 'complete') {
    return NextResponse.json({ error: 'Draft already complete' }, { status: 400 });
  }

  const body = await request.json();
  const { positions, pick_entry_mode, pick_timer_seconds, admin_team_name } = body;

  if (!positions || !Array.isArray(positions) || positions.length === 0) {
    return NextResponse.json({ error: 'positions array required' }, { status: 400 });
  }

  if (!pick_entry_mode || !['admin_only', 'self_draft'].includes(pick_entry_mode)) {
    return NextResponse.json({ error: 'pick_entry_mode must be admin_only or self_draft' }, { status: 400 });
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

  const { data: existingParticipant } = await adminClient
    .from('draft_participants')
    .select('id')
    .eq('draft_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  let adminParticipantId = existingParticipant?.id || null;

  if (!existingParticipant) {
    const { data: newParticipant, error: createError } = await adminClient
      .from('draft_participants')
      .insert({
        draft_id: id,
        user_id: user.id,
        team_name: admin_team_name || 'Commissioner',
      })
      .select('id')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    adminParticipantId = newParticipant.id;
  }

  const positionParticipantIds = new Set(positions.map((p: { participant_id: string }) => p.participant_id));
  const hasPlaceholder = positionParticipantIds.has('__admin__');

  if (hasPlaceholder) {
    const placeholderIndex = positions.findIndex((p: { participant_id: string }) => p.participant_id === '__admin__');
    if (placeholderIndex !== -1 && adminParticipantId) {
      positions[placeholderIndex].participant_id = adminParticipantId;
    } else if (placeholderIndex !== -1) {
      positions.splice(placeholderIndex, 1);
    }
  }

  if (adminParticipantId && !positions.some((p: { participant_id: string }) => p.participant_id === adminParticipantId)) {
    const usedPositions = new Set(positions.map((p: { draft_position: number }) => p.draft_position));
    let nextPos = 1;
    while (usedPositions.has(nextPos)) nextPos++;
    positions.push({ participant_id: adminParticipantId, draft_position: nextPos });
  }

  for (const pos of positions) {
    const { error: updateError } = await adminClient
      .from('draft_participants')
      .update({ draft_position: pos.draft_position })
      .eq('id', pos.participant_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const updateData: Record<string, unknown> = {
    status: 'in_progress',
    current_round: 1,
    current_pick: 1,
    pick_entry_mode,
  };

  if (pick_timer_seconds !== undefined) {
    updateData.pick_timer_seconds = pick_timer_seconds;
  }

  const { error: draftUpdateError } = await adminClient
    .from('drafts')
    .update(updateData)
    .eq('id', id);

  if (draftUpdateError) {
    return NextResponse.json({ error: draftUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
