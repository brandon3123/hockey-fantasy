import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { getIsAdmin } from '@/lib/admin';

export async function DELETE(
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
    .select('id, status, current_round, current_pick')
    .eq('id', id)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (!await getIsAdmin(user.id)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  if (draft.status !== 'in_progress') {
    return NextResponse.json({ error: 'Draft is not in progress' }, { status: 400 });
  }

  const { data: lastPick, error: pickError } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('draft_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pickError || !lastPick) {
    return NextResponse.json({ error: 'No picks to undo' }, { status: 404 });
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

  const { error: deleteError } = await adminClient
    .from('draft_picks')
    .delete()
    .eq('id', lastPick.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  let prevRound = draft.current_round;
  let prevPick = draft.current_pick - 1;

  if (prevPick < 1) {
    prevRound = Math.max(1, prevRound - 1);
    const { data: participants } = await supabase
      .from('draft_participants')
      .select('id')
      .eq('draft_id', id);
    const managers = participants?.length || 1;
    prevPick = prevRound === 1 && prevRound < draft.current_round ? managers : Math.max(1, prevPick);
    if (prevRound < draft.current_round) {
      prevPick = managers;
    }
  }

  if (prevRound < 1) prevRound = 1;
  if (prevPick < 1) prevPick = 1;

  const { error: revertError } = await adminClient
    .from('drafts')
    .update({ current_round: prevRound, current_pick: prevPick })
    .eq('id', id);

  if (revertError) {
    return NextResponse.json({ error: revertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
