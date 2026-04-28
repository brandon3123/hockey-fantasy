import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { fetchCompletedGames, fetchGameResults } from '@/lib/nhl-api';
import { sendDailyEmails } from '@/lib/send-daily-email';

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
      emailsSent: 0,
      emailErrors: [] as string[],
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

  let emailsSent = 0;
  let emailErrors: string[] = [];

  for (const draft of drafts) {
    const { data: draftDetails } = await adminClient
      .from('drafts')
      .select('id, name, scoring_format, season_type')
      .eq('id', draft.id)
      .single();

    if (!draftDetails) continue;

    const { data: participants } = await adminClient
      .from('draft_participants')
      .select('id, team_name, user_id')
      .eq('draft_id', draft.id);

    if (!participants || participants.length === 0) continue;

    const userIds = participants.map((p) => p.user_id);
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    for (const u of authUsers ?? []) {
      if (u.email) emailMap.set(u.id, u.email);
    }

    const participantsWithEmail = participants
      .map((p) => ({
        email: emailMap.get(p.user_id) ?? '',
        participantId: p.id,
        teamName: p.team_name,
      }))
      .filter((p) => p.email.length > 0);

    if (participantsWithEmail.length === 0) continue;

    const { data: draftPicks } = await adminClient
      .from('draft_picks')
      .select('player_id, player_name, participant_id, round')
      .eq('draft_id', draft.id);

    const { data: draftScores } = await adminClient
      .from('player_scores')
      .select('player_id, score_date, goals, assists, points')
      .eq('draft_id', draft.id);

    const { data: draftPlayers } = await adminClient
      .from('players')
      .select('id, name, team, position');

    const playerMap = new Map((draftPlayers ?? []).map((p) => [p.id, p]));
    const scoresByPlayer = new Map<string, Map<string, { goals: number; assists: number; points: number }>>();
    for (const s of draftScores ?? []) {
      if (!scoresByPlayer.has(s.player_id)) scoresByPlayer.set(s.player_id, new Map());
      scoresByPlayer.get(s.player_id)!.set(s.score_date, { goals: s.goals, assists: s.assists, points: s.points });
    }

    const standings = participants.map((p) => {
      const myPicks = (draftPicks ?? []).filter((pick) => pick.participant_id === p.id);
      const roster = myPicks.map((pick) => {
        const player = playerMap.get(pick.player_id);
        const playerScores = scoresByPlayer.get(pick.player_id);
        let goals = 0, assists = 0, points = 0, gamesPlayed = 0;
        if (playerScores) {
          for (const [, ds] of playerScores) {
            goals += ds.goals;
            assists += ds.assists;
            points += ds.points;
            gamesPlayed++;
          }
        }
        return {
          playerId: pick.player_id,
          playerName: pick.player_name,
          team: player?.team ?? '',
          position: player?.position ?? '',
          round: pick.round,
          goals,
          assists,
          points,
          gamesPlayed,
        };
      });
      const totalPoints = roster.reduce((sum, r) => sum + r.points, 0);
      let yesterdayPoints = 0;
      for (const r of roster) {
        const ds = scoresByPlayer.get(r.playerId)?.get(dateStr);
        if (ds) yesterdayPoints += ds.points;
      }
      return {
        participantId: p.id,
        teamName: p.team_name,
        totalPoints,
        yesterdayPoints,
        roster,
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    const tonightGames: { gameId: number; away: string; home: string; time: string }[] = [];

    const result = await sendDailyEmails({
      draftId: draft.id,
      draftName: draftDetails.name ?? 'Draft',
      seasonType: draftDetails.season_type ?? 'regular_season',
      date: dateStr,
      standings,
      tonightGames,
      participantsWithEmail,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
    });

    emailsSent += result.sent;
    emailErrors = emailErrors.concat(result.errors);
  }

  return NextResponse.json({
    date: dateStr,
    games: completedGames.length,
    results: allResults.length,
    upserted,
    emailsSent,
    emailErrors,
    dryRun: false,
  });
}
