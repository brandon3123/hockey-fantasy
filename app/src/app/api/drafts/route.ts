import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  return NextResponse.json({ drafts: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
