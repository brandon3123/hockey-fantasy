import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { fetchCompletedGames, fetchGameResults, buildNhlIdToNameMap } from '@/lib/nhl-api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: draft } = await supabase
    .from('drafts').select('admin_user_id, scoring_format, season_type').eq('id', id).single();
  if (!draft || draft.admin_user_id !== user.id)
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

  const { dates } = await request.json();
  if (!dates || !Array.isArray(dates) || dates.length === 0)
    return NextResponse.json({ error: 'dates array required' }, { status: 400 });

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: picks } = await adminClient
    .from('draft_picks').select('player_id, player_name, participant_id').eq('draft_id', id);
  if (!picks || picks.length === 0)
    return NextResponse.json({ error: 'No picks found' }, { status: 400 });

  const pickMap = new Map<string, string>();
  for (const pick of picks) {
    if (pick.player_name) pickMap.set(pick.player_name.toLowerCase(), pick.player_id);
  }

  const { data: participants } = await adminClient
    .from('draft_participants').select('id, team_name').eq('draft_id', id);
  const participantMap = new Map((participants ?? []).map((p) => [p.id, p.team_name]));
  const playerToTeam = new Map<string, string>();
  for (const pick of picks) {
    if (pick.participant_id) {
      const teamName = participantMap.get(pick.participant_id);
      if (teamName) playerToTeam.set(pick.player_id, teamName);
    }
  }

  const results: { date: string; games: number; results: number; upserted: number; errors: string[]; scorers: any[]; teamPoints: any[] }[] = [];

  for (const dateStr of dates) {
    const completedGames = await fetchCompletedGames(dateStr);
    const teamAbbrevs = [...new Set(completedGames.flatMap(g => [g.away, g.home]))];
    const nhlIdToName = await buildNhlIdToNameMap(teamAbbrevs);

    const allGameResults: Awaited<ReturnType<typeof fetchGameResults>> = [];
    for (const game of completedGames) {
      const gameResults = await fetchGameResults(game.gameId);
      allGameResults.push(...gameResults);
    }

    const rowsToUpsert: any[] = [];
    const errors: string[] = [];
    const scorers: { playerName: string; nhlTeam: string; goals: number; assists: number; points: number; fantasyTeam: string }[] = [];

    for (const result of allGameResults) {
      const fullName = nhlIdToName.get(result.nhlId);
      if (!fullName) continue;
      const playerId = pickMap.get(fullName.toLowerCase());
      if (!playerId) { errors.push(`Unmatched: ${fullName}`); continue; }
      const pts = draft.scoring_format === '2pt_goals_1pt_assists'
        ? result.goals * 2 + result.assists : result.goals + result.assists;
      rowsToUpsert.push({
        player_id: playerId, draft_id: id,
        season_type: draft.season_type ?? 'playoffs',
        score_date: dateStr, goals: result.goals, assists: result.assists, points: pts,
      });
      scorers.push({
        playerName: fullName, nhlTeam: result.team,
        goals: result.goals, assists: result.assists, points: pts,
        fantasyTeam: playerToTeam.get(playerId) ?? 'Unknown',
      });
    }

    let upserted = 0;
    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await adminClient
        .from('player_scores').upsert(rowsToUpsert, { onConflict: 'player_id,draft_id,score_date' });
      if (upsertError) errors.push(`Upsert error: ${upsertError.message}`);
      else upserted = rowsToUpsert.length;
    }

    const teamPointsMap = new Map<string, number>();
    for (const s of scorers) {
      teamPointsMap.set(s.fantasyTeam, (teamPointsMap.get(s.fantasyTeam) ?? 0) + s.points);
    }
    const teamPoints = Array.from(teamPointsMap.entries())
      .map(([teamName, points]) => ({ teamName, points }))
      .sort((a, b) => b.points - a.points);

    await adminClient.from('cron_runs').insert({
      draft_id: id, run_date: dateStr,
      games_found: completedGames.length, results_found: allGameResults.length,
      scores_upserted: upserted, emails_sent: 0, errors,
      score_details: { scorers, teamPoints },
    });

    results.push({ date: dateStr, games: completedGames.length, results: allGameResults.length, upserted, errors, scorers, teamPoints });
  }

  return NextResponse.json({ results });
}
