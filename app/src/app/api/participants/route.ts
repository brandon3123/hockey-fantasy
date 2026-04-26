import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { draft_id, team_name } = await request.json();

  if (!draft_id || !team_name) {
    return NextResponse.json({ error: 'draft_id and team_name required' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('draft_participants')
    .select('id')
    .eq('draft_id', draft_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Already registered for this draft' }, { status: 400 });
  }

  const { data: invite } = await supabase
    .from('draft_invites')
    .select('id')
    .eq('draft_id', draft_id)
    .eq('email', user.email)
    .maybeSingle();

  const { data, error } = await supabase
    .from('draft_participants')
    .insert({
      draft_id,
      user_id: user.id,
      team_name,
      invite_id: invite?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (invite) {
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
    await adminClient
      .from('draft_invites')
      .update({ status: 'registered' })
      .eq('id', invite.id);
  }

  return NextResponse.json({ participant: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { participant_id } = await request.json();

  if (!participant_id) {
    return NextResponse.json({ error: 'participant_id required' }, { status: 400 });
  }

  const { data: participant } = await supabase
    .from('draft_participants')
    .select('id, draft_id')
    .eq('id', participant_id)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', participant.draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  const { error } = await supabase
    .from('draft_participants')
    .delete()
    .eq('id', participant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { participant_id, has_paid } = await request.json();

  if (!participant_id || typeof has_paid !== 'boolean') {
    return NextResponse.json({ error: 'participant_id and has_paid required' }, { status: 400 });
  }

  const { data: participant } = await supabase
    .from('draft_participants')
    .select('id, draft_id')
    .eq('id', participant_id)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', participant.draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  const { error } = await supabase
    .from('draft_participants')
    .update({ has_paid })
    .eq('id', participant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
