import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { fetchCompletedGames, fetchGameResults } from '@/lib/nhl-api';

export async function GET(request: Request) {
  if (process.env.CRON_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Cron disabled' }, { status: 404 });
  }

  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const offset = parseInt(process.env.SCORES_DATE_OFFSET ?? '1', 10);
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - offset);
  const dateStr = targetDate.toISOString().slice(0, 10);

  const dryRun = process.env.SCORES_DRY_RUN === 'true';

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );

  const { data: drafts, error: draftsError } = await adminClient
    .from('drafts')
    .select('id, scoring_format')
    .eq('status', 'complete');

  if (draftsError || !drafts || drafts.length === 0) {
    return NextResponse.json({
      date: dateStr,
      games: 0,
      results: 0,
      upserted: 0,
      dryRun,
      error: 'No completed drafts found',
    });
  }

  const completedGames = await fetchCompletedGames(dateStr);

  const allResults: Awaited<ReturnType<typeof fetchGameResults>> = [];
  for (const game of completedGames) {
    const results = await fetchGameResults(game.gameId);
    allResults.push(...results);
  }

  if (dryRun) {
    return NextResponse.json({
      date: dateStr,
      games: completedGames.length,
      results: allResults.length,
      upserted: 0,
      dryRun: true,
    });
  }

  let upserted = 0;

  for (const draft of drafts) {
    const { data: picks } = await adminClient
      .from('draft_picks')
      .select('player_id, player_name')
      .eq('draft_id', draft.id);

    if (!picks || picks.length === 0) continue;

    const pickMap = new Map<string, string>();
    for (const pick of picks) {
      if (pick.player_name) {
        pickMap.set(pick.player_name.toLowerCase(), pick.player_id);
      }
    }

    const rowsToUpsert: {
      player_id: string;
      draft_id: string;
      score_date: string;
      goals: number;
      assists: number;
      points: number;
    }[] = [];

    for (const result of allResults) {
      const playerId = pickMap.get(result.playerName.toLowerCase());
      if (!playerId) continue;

      let points: number;
      if (draft.scoring_format === '2pt_goals_1pt_assists') {
        points = result.goals * 2 + result.assists;
      } else {
        points = result.goals + result.assists;
      }

      rowsToUpsert.push({
        player_id: playerId,
        draft_id: draft.id,
        score_date: dateStr,
        goals: result.goals,
        assists: result.assists,
        points,
      });
    }

    if (rowsToUpsert.length === 0) continue;

    const { error: upsertError } = await adminClient
      .from('player_scores')
      .upsert(rowsToUpsert, {
        onConflict: 'player_id,draft_id,score_date',
      });

    if (upsertError) {
      console.error(`Upsert error for draft ${draft.id}:`, upsertError);
    } else {
      upserted += rowsToUpsert.length;
    }
  }

  return NextResponse.json({
    date: dateStr,
    games: completedGames.length,
    results: allResults.length,
    upserted,
    dryRun: false,
  });
}
