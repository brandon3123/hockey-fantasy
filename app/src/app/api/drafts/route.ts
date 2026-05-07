import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIsAdmin } from '@/lib/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('admin_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: participations } = await supabase
    .from('draft_participants')
    .select('draft_id, team_name, has_paid')
    .eq('user_id', user.id);

  const joinedDraftIds = (participations || []).map(p => p.draft_id);

  let joinedDrafts: any[] = [];
  if (joinedDraftIds.length > 0) {
    const { data: joinedData } = await supabase
      .from('drafts')
      .select('*')
      .in('id', joinedDraftIds)
      .order('created_at', { ascending: false });
    joinedDrafts = (joinedData || []).filter(d => d.admin_user_id !== user.id);
  }

  const participationMap = new Map((participations || []).map(p => [p.draft_id, p]));

  const { data: allParticipants } = await supabase
    .from('draft_participants')
    .select('draft_id, has_paid');

  const { data: allInvites } = await supabase
    .from('draft_invites')
    .select('draft_id, accepted');

  const participantCounts = new Map<string, { joined: number; paid: number }>();
  for (const p of allParticipants || []) {
    const entry = participantCounts.get(p.draft_id) || { joined: 0, paid: 0 };
    entry.joined++;
    if (p.has_paid) entry.paid++;
    participantCounts.set(p.draft_id, entry);
  }

  const inviteCounts = new Map<string, number>();
  for (const inv of allInvites || []) {
    if (!inv.accepted) {
      inviteCounts.set(inv.draft_id, (inviteCounts.get(inv.draft_id) || 0) + 1);
    }
  }

  return NextResponse.json({
    drafts: (data || []).map(d => ({
      ...d,
      joined_count: participantCounts.get(d.id)?.joined || 0,
      pending_count: inviteCounts.get(d.id) || 0,
      paid_count: participantCounts.get(d.id)?.paid || 0,
    })),
    joined: joinedDrafts.map(d => ({
      ...d,
      team_name: participationMap.get(d.id)?.team_name,
      has_paid: participationMap.get(d.id)?.has_paid,
      joined_count: participantCounts.get(d.id)?.joined || 0,
      pending_count: inviteCounts.get(d.id) || 0,
      paid_count: participantCounts.get(d.id)?.paid || 0,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminCheck = await getIsAdmin(user.id);
  if (!adminCheck) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    season_type,
    draft_date,
    draft_time,
    location,
    entry_fee,
    currency,
    payment_method,
    payment_info,
    notes,
    players_per_team,
    scoring_format,
  } = body;

  if (draft_date) {
    const selectedDate = new Date(draft_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return NextResponse.json({ error: 'Draft date cannot be in the past' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('drafts')
    .insert({
      name,
      season_type,
      draft_date,
      draft_time,
      location,
      entry_fee,
      currency,
      payment_method,
      payment_info,
      notes,
      players_per_team,
      scoring_format,
      admin_user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { draft_id } = await request.json();

  if (!draft_id) {
    return NextResponse.json({ error: 'draft_id required' }, { status: 400 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('id, admin_user_id')
    .eq('id', draft_id)
    .single();

  if (!draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const adminCheck = await getIsAdmin(user.id);
  if (!adminCheck) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('id', draft_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
