import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    await supabase
      .from('draft_invites')
      .update({ status: 'registered' })
      .eq('id', invite.id);
  }

  return NextResponse.json({ participant: data }, { status: 201 });
}
