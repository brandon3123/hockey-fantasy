import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { getIsAdmin } from '@/lib/admin';

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
    .select('id')
    .eq('id', id)
    .single();

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (!await getIsAdmin(user.id)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
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

  const { error: deletePicksError } = await adminClient
    .from('draft_picks')
    .delete()
    .eq('draft_id', id);

  if (deletePicksError) {
    return NextResponse.json({ error: deletePicksError.message }, { status: 500 });
  }

  const { error: clearPositionsError } = await adminClient
    .from('draft_participants')
    .update({ draft_position: null })
    .eq('draft_id', id);

  if (clearPositionsError) {
    return NextResponse.json({ error: clearPositionsError.message }, { status: 500 });
  }

  const { error: updateError } = await adminClient
    .from('drafts')
    .update({
      status: 'setup',
      current_round: 1,
      current_pick: 1,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
