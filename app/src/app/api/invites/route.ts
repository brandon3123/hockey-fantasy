import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { draft_id, emails } = await request.json();

  if (!draft_id || !emails || !Array.isArray(emails)) {
    return NextResponse.json({ error: 'draft_id and emails array required' }, { status: 400 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const results = [];

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) continue;

    const { data: invite, error } = await supabase
      .from('draft_invites')
      .insert({ draft_id, email: trimmed })
      .select()
      .single();

    if (error) {
      results.push({ email: trimmed, status: 'error', error: error.message });
      continue;
    }

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      trimmed,
      { redirectTo: `${appUrl}/auth/callback` }
    );

    if (inviteError) {
      results.push({ email: trimmed, status: 'invited_no_email', invite_id: invite.id, note: 'User may already exist. Share the join link manually.' });
    } else {
      results.push({ email: trimmed, status: 'invited', invite_id: invite.id });
    }
  }

  return NextResponse.json({ results });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { invite_id } = await request.json();

  if (!invite_id) {
    return NextResponse.json({ error: 'invite_id required' }, { status: 400 });
  }

  const { data: invite } = await supabase
    .from('draft_invites')
    .select('id, draft_id')
    .eq('id', invite_id)
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', invite.draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  const { error } = await supabase
    .from('draft_invites')
    .delete()
    .eq('id', invite_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
