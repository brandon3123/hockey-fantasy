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

  const { data: draft } = await supabase
    .from('drafts')
    .select('id, admin_user_id, status')
    .eq('id', id)
    .single();

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json();
  const { pick_id, new_player_id, new_player_name } = body;

  if (!pick_id || !new_player_id) {
    return NextResponse.json({ error: 'pick_id and new_player_id required' }, { status: 400 });
  }

  const { data: existingPick, error: pickError } = await supabase
    .from('draft_picks')
    .select('id, draft_id, round, pick_number, manager_index, participant_id')
    .eq('id', pick_id)
    .eq('draft_id', id)
    .single();

  if (pickError || !existingPick) {
    return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
  }

  const { data: dupCheck } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('draft_id', id)
    .eq('player_id', new_player_id)
    .maybeSingle();

  if (dupCheck) {
    return NextResponse.json({ error: 'Player already drafted' }, { status: 409 });
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
    .eq('id', pick_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const { error: insertError } = await adminClient
    .from('draft_picks')
    .insert({
      draft_id: id,
      round: existingPick.round,
      pick_number: existingPick.pick_number,
      manager_index: existingPick.manager_index,
      participant_id: existingPick.participant_id,
      player_id: new_player_id,
      player_name: new_player_name || null,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
