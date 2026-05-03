import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { fetchTonightGames, fetchEspnInjuries, fetchActivePlayoffTeams } from '@/lib/nhl-api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: draft, error } = await supabase
    .from('drafts')
    .select('id, name, season_type, players_per_team, scoring_format, status')
    .eq('id', id)
    .single();

  if (error || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.status !== 'complete') {
    return NextResponse.json({ error: 'Draft not complete' }, { status: 404 });
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

  const [picksResult, participantsResult, scoresResult, playersResult] = await Promise.all([
    adminClient.from('draft_picks').select('*').eq('draft_id', id).order('round', { ascending: true }),
    adminClient.from('draft_participants').select('id, team_name, draft_position, user_id').eq('draft_id', id),
    adminClient.from('player_scores').select('player_id, score_date, goals, assists, points').eq('draft_id', id),
    adminClient.from('players').select('id, name, team, position'),
  ]);

  const picks = picksResult.data || [];
  const participants = participantsResult.data || [];
  const scores = scoresResult.data || [];
  const players = playersResult.data || [];

  const playerMap = new Map<string, { name: string; team: string; position: string }>();
  for (const p of players) {
    playerMap.set(p.id, { name: p.name, team: p.team, position: p.position });
  }

  const [espnInjuries, activePlayoffTeams] = await Promise.all([
    fetchEspnInjuries(),
    fetchActivePlayoffTeams(),
  ]);

  const scoresByPlayer = new Map<string, Map<string, { goals: number; assists: number; points: number }>>();
  for (const s of scores) {
    if (!scoresByPlayer.has(s.player_id)) {
      scoresByPlayer.set(s.player_id, new Map());
    }
    scoresByPlayer.get(s.player_id)!.set(s.score_date, { goals: s.goals, assists: s.assists, points: s.points });
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  const todayET = `${y}-${m}-${d}`;

  const yesterdayDate = new Date(`${todayET}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(`${todayET}T12:00:00`);
    dd.setDate(dd.getDate() - i);
    last7Days.push(dd.toISOString().slice(0, 10));
  }

  const standings = participants.map((participant) => {
    const participantPicks = picks.filter((p) => p.participant_id === participant.id);

    const roster = participantPicks.map((pick) => {
      const playerInfo = playerMap.get(pick.player_id) || { name: pick.player_name || pick.player_id, team: '', position: '' };
      const playerScores = scoresByPlayer.get(pick.player_id);

      let totalGoals = 0;
      let totalAssists = 0;
      let totalPoints = 0;
      let gamesPlayed = 0;

      if (playerScores) {
        for (const score of playerScores.values()) {
          totalGoals += score.goals;
          totalAssists += score.assists;
          totalPoints += score.points;
          gamesPlayed++;
        }
      }

      const injuryInfo = espnInjuries.get(playerInfo.name.toLowerCase());
      const isEliminated = activePlayoffTeams.size > 0 && playerInfo.team && !activePlayoffTeams.has(playerInfo.team);

      return {
        playerId: pick.player_id,
        playerName: playerInfo.name,
        team: playerInfo.team,
        position: playerInfo.position,
        round: pick.round,
        goals: totalGoals,
        assists: totalAssists,
        points: totalPoints,
        gamesPlayed,
        injuryStatus: injuryInfo?.status ?? "healthy",
        injuryDescription: injuryInfo?.description ?? null,
        isEliminated,
      };
    });

    const totalPoints = roster.reduce((sum, p) => sum + p.points, 0);

    const yesterdayPoints = roster.reduce((sum, p) => {
      const playerScores = scoresByPlayer.get(p.playerId);
      if (!playerScores) return sum;
      const dayScore = playerScores.get(yesterdayStr);
      return sum + (dayScore?.points || 0);
    }, 0);

    const trend7Day = last7Days.map((dateStr) =>
      roster.reduce((sum, p) => {
        const playerScores = scoresByPlayer.get(p.playerId);
        if (!playerScores) return sum;
        const dayScore = playerScores.get(dateStr);
        return sum + (dayScore?.points || 0);
      }, 0)
    );

    return {
      participantId: participant.id,
      userId: participant.user_id,
      teamName: participant.team_name,
      totalPoints,
      yesterdayPoints,
      gamesBehind: 0,
      trend7Day,
      roster,
    };
  });

  standings.sort((a, b) => b.totalPoints - a.totalPoints);

  const leaderPoints = standings.length > 0 ? standings[0].totalPoints : 0;
  for (const s of standings) {
    s.gamesBehind = leaderPoints - s.totalPoints;
  }

  for (let i = 0; i < standings.length; i++) {
    (standings[i] as typeof standings[0] & { rank: number }).rank = i + 1;
  }

  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get('tz') || undefined;

  const rankedStandings = standings.map((s, i) => ({ ...s, rank: i + 1 }));

  const tonightGames = await fetchTonightGames(timezone).catch(() => []);

  const currentParticipant = participants.find((p) => p.user_id === user?.id);
  const myTeamAbbrevs = new Set<string>();
  if (currentParticipant) {
    const myPicks = picks.filter((p) => p.participant_id === currentParticipant.id);
    for (const pick of myPicks) {
      const playerInfo = playerMap.get(pick.player_id);
      if (playerInfo?.team) myTeamAbbrevs.add(playerInfo.team);
    }
  }

  const tonightGamesWithFlag = tonightGames.map((game) => ({
    ...game,
    hasDraftedPlayers: myTeamAbbrevs.has(game.away) || myTeamAbbrevs.has(game.home),
  }));

  return NextResponse.json({
    draft: {
      id: draft.id,
      name: draft.name,
      season_type: draft.season_type,
      players_per_team: draft.players_per_team,
      scoring_format: draft.scoring_format,
    },
    standings: rankedStandings,
    tonightGames: tonightGamesWithFlag,
    yesterday: yesterdayStr,
    currentUserId: user?.id || null,
  });
}
