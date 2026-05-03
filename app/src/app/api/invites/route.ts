import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';
import { generateInviteEmailHtml } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    .select('admin_user_id, name')
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
  const logoUrl = `${appUrl}/logo/logo-email.svg`;
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

    const { data: userList } = await adminClient.auth.admin.listUsers();
    const existingUser = userList?.users?.find(u => u.email === trimmed);

    console.log('[POST] email:', trimmed, 'existingUser:', !!existingUser);

    if (existingUser) {
      const joinUrl = `${appUrl}/join/${draft_id}`;
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@contact.brandon-nolan.ca';

      try {
        await resend.emails.send({
          from: `Top Shelf Draft <${fromEmail}>`,
          to: trimmed,
          subject: `You're Invited to a Hockey Draft!`,
          html: generateInviteEmailHtml(draft.name || '', joinUrl, logoUrl),
        });
        results.push({ email: trimmed, status: 'invited', invite_id: invite.id });
      } catch (emailErr: any) {
        console.error('Resend error for existing user:', emailErr.message);
        results.push({ email: trimmed, status: 'invited_no_email', invite_id: invite.id, error: emailErr.message, note: 'Email failed. Share the join link manually.' });
      }
    } else {
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        trimmed,
        { redirectTo: `${appUrl}/auth/verify` }
      );

      if (inviteError) {
        console.error('inviteUserByEmail error:', inviteError.message, inviteError.status);
        results.push({ email: trimmed, status: 'invited_no_email', invite_id: invite.id, error: inviteError.message, code: inviteError.status, note: 'Supabase invite failed. Share the join link manually.' });
      } else {
        results.push({ email: trimmed, status: 'invited', invite_id: invite.id });
      }
    }
  }

  return NextResponse.json({ results });
}

export async function PATCH(request: Request) {
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
    .select('id, email, draft_id')
    .eq('id', invite_id)
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id, name')
    .eq('id', invite.draft_id)
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
  const joinUrl = `${appUrl}/join/${invite.draft_id}`;
  const logoUrl = `${appUrl}/logo/logo-email.svg`;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@contact.brandon-nolan.ca';

  const { data: userList } = await adminClient.auth.admin.listUsers();
  const existingUser = userList?.users?.find(u => u.email === invite.email);

  if (existingUser) {
    try {
      await resend.emails.send({
        from: `Top Shelf Draft <${fromEmail}>`,
        to: invite.email,
        subject: `You're Invited to a Hockey Draft!`,
        html: generateInviteEmailHtml(draft.name || '', joinUrl, logoUrl),
      });
      return NextResponse.json({ success: true });
    } catch (emailErr: any) {
      console.error('Resend error:', emailErr.message);
      return NextResponse.json({ error: emailErr.message }, { status: 500 });
    }
  } else {
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      invite.email,
      { redirectTo: `${appUrl}/auth/verify` }
    );

    if (inviteError) {
      console.error('inviteUserByEmail error:', inviteError.message);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }
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
