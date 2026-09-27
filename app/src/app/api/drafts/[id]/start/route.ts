import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { getIsAdmin } from '@/lib/admin';
import { findDuplicateName, isCompleteOrder } from '@/lib/roster-participants';

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
    .select('id, status, players_per_team, participant_mode')
    .eq('id', id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (!await getIsAdmin(user.id)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  if (draft.status === 'in_progress') {
    return NextResponse.json({ error: 'Draft already in progress' }, { status: 400 });
  }

  if (draft.status === 'complete') {
    return NextResponse.json({ error: 'Draft already complete' }, { status: 400 });
  }

  const body = await request.json();
  const { positions, pick_entry_mode, pick_timer_seconds, admin_team_name, renames } = body;

  if (!positions || !Array.isArray(positions) || positions.length === 0) {
    return NextResponse.json({ error: 'positions array required' }, { status: 400 });
  }

  // Roster drafts have no accounts to self-draft from: the mode is forced.
  const isRosterDraft = draft.participant_mode === 'roster';
  const effectiveMode = isRosterDraft ? 'admin_only' : pick_entry_mode;

  if (!effectiveMode || !['admin_only', 'self_draft'].includes(effectiveMode)) {
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

  // The order must be a complete 1..N permutation — duplicate or missing
  // numbers strand the clock (a turn check against a position nobody holds).
  const { count: seatCount } = await adminClient
    .from('draft_participants')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', id);
  if (!isCompleteOrder(
    positions.map((p: { draft_position: number }) => p.draft_position),
    seatCount ?? 0,
  )) {
    return NextResponse.json({ error: 'Draft order must assign each position exactly once' }, { status: 400 });
  }


  const { data: existingParticipant } = await adminClient
    .from('draft_participants')
    .select('id')
    .eq('draft_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  let adminParticipantId = existingParticipant?.id || null;

  // Roster drafts seat everyone up front; if the admin opted out of a seat,
  // do not fabricate one at start time.
  if (!existingParticipant && !isRosterDraft) {
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

  // Roster seats are renameable until the draft starts (start modal). Renames
  // share one namespace with every other seat — final names, case-insensitive.
  if (isRosterDraft && renames && typeof renames === 'object') {
    const { data: seatsForNames } = await adminClient
      .from('draft_participants')
      .select('id, team_name')
      .eq('draft_id', id);
    const seatsWithName = seatsForNames ?? [];

    const finalNames = positions.map((pos: { participant_id: string }) => {
      const seat = seatsWithName.find(p => p.id === pos.participant_id);
      const renamed = renames[pos.participant_id];
      return typeof renamed === 'string' && renamed.trim() ? renamed : seat?.team_name ?? '';
    });
    const dup = findDuplicateName(finalNames);
    if (dup) {
      return NextResponse.json({ error: `Duplicate team name: ${dup}` }, { status: 400 });
    }

    for (const [participantId, newName] of Object.entries(renames)) {
      const trimmed = typeof newName === 'string' ? newName.trim() : '';
      if (!trimmed) continue;
      const { error: renameError } = await adminClient
        .from('draft_participants')
        .update({ team_name: trimmed })
        .eq('id', participantId)
        .eq('draft_id', id)
        .is('user_id', null);

      if (renameError) {
        const conflict = renameError.code === '23505';
        return NextResponse.json(
          { error: conflict ? 'Team name already in use' : renameError.message },
          { status: conflict ? 400 : 500 }
        );
      }
    }
  }

  const updateData: Record<string, unknown> = {
    status: 'in_progress',
    current_round: 1,
    current_pick: 1,
    pick_entry_mode: effectiveMode,
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
