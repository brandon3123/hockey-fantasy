import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: draft } = await supabase
    .from('drafts').select('admin_user_id, scoring_format').eq('id', id).single();
  if (!draft || draft.admin_user_id !== user.id)
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

  const { player_id, goals, assists } = await request.json();
  if (!player_id) return NextResponse.json({ error: 'player_id required' }, { status: 400 });

  const g = typeof goals === 'number' ? goals : 0;
  const a = typeof assists === 'number' ? assists : 0;
  const pts = draft.scoring_format === '2pt_goals_1pt_assists' ? g * 2 + a : g + a;

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: existing } = await adminClient
    .from('player_scores').select('season_type').eq('draft_id', id).eq('player_id', player_id).limit(1);
  const seasonType = (existing && existing.length > 0) ? existing[0].season_type : 'playoffs';

  await adminClient.from('player_scores').delete().eq('draft_id', id).eq('player_id', player_id);

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await adminClient.from('player_scores').insert({
    player_id, draft_id: id, score_date: today, season_type: seasonType,
    goals: g, assists: a, points: pts,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ score: data });
}
