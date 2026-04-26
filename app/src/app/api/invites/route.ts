import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

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
    .select('admin_user_id, name, draft_date, draft_time, location, entry_fee, currency')
    .eq('id', draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const joinUrl = `${appUrl}/join/${draft_id}`;
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

    const dateStr = draft.draft_date
      ? new Date(draft.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;

    const details: string[] = [];
    if (dateStr) details.push(`<strong>Date:</strong> ${dateStr}`);
    if (draft.draft_time) details.push(`<strong>Time:</strong> ${draft.draft_time}`);
    if (draft.location) details.push(`<strong>Location:</strong> ${draft.location}`);
    if (draft.entry_fee > 0) details.push(`<strong>Entry Fee:</strong> $${draft.entry_fee} ${draft.currency}`);

    const detailsHtml = details.length > 0
      ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td style="padding:8px 0;">${details.join('</td></tr><tr><td style="padding:8px 0;">')}</td></tr></table>`
      : '';

    const { error: emailError } = await resend.emails.send({
      from: 'Top Shelf Draft <noreply@' + (process.env.RESEND_FROM_DOMAIN || 'resend.dev') + '>',
      to: trimmed,
      subject: `You're Invited to ${draft.name}!`,
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:system-ui,sans-serif;">
          <h2 style="color:#4a7c59;font-size:24px;margin:0 0 8px 0;">You're Invited!</h2>
          <p style="color:#c8d9c3;font-size:16px;line-height:1.6;margin:0 0 24px 0;">
            You've been invited to join <strong style="color:#4a7c59;">${draft.name}</strong>.
            Create your account and pick your team name to get started.
          </p>
          ${detailsHtml}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr>
              <td align="center">
                <a href="${joinUrl}" style="background-color:#4a7c59;color:#c8d9c3;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
                  Join the Draft
                </a>
              </td>
            </tr>
          </table>
          <p style="color:#8a9b87;font-size:14px;line-height:1.6;margin:0 0 12px 0;">
            If the button doesn't work, copy and paste this link:
          </p>
          <p style="color:#4a7c59;font-family:monospace;font-size:13px;word-break:break-all;margin:0 0 24px 0;">
            ${joinUrl}
          </p>
          <hr style="border:none;border-top:1px solid #1a2418;margin:24px 0;" />
          <p style="color:#5a6b57;font-size:12px;margin:0;">
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (emailError) {
      results.push({ email: trimmed, status: 'invited_no_email', invite_id: invite.id, note: `Email failed: ${emailError.message}. Share the join link manually.` });
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
