import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { fetchTonightGames, fetchEspnInjuries, fetchActivePlayoffTeams } from '@/lib/nhl-api';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: drafts } = await supabase
    .from('drafts')
    .select('id, name, status, season_type, scoring_format, created_at, admin_user_id')
    .eq('admin_user_id', user.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false });

  const { data: participations } = await supabase
    .from('draft_participants')
    .select('draft_id')
    .eq('user_id', user.id);

  const participatedDraftIds = new Set((participations || []).map(p => p.draft_id));

  const completeDraft = (drafts || []).find(d =>
    participatedDraftIds.has(d.id) || true
  );

  if (!completeDraft) {
    const { data: joinedDrafts } = await supabase
      .from('drafts')
      .select('id, name, status, season_type, scoring_format, created_at, admin_user_id')
      .in('id', [...participatedDraftIds])
      .eq('status', 'complete')
      .order('created_at', { ascending: false });

    if (!joinedDrafts || joinedDrafts.length === 0) {
      return NextResponse.json({ draft: null });
    }
  }

  const draft = completeDraft || await (async () => {
    const { data } = await supabase
      .from('drafts')
      .select('id, name, status, season_type, scoring_format, created_at, admin_user_id')
      .in('id', [...participatedDraftIds])
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);
    return data?.[0];
  })();

  if (!draft) {
    return NextResponse.json({ draft: null });
  }

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll() { return []; }, setAll() {} },
    }
  );

  const [picksResult, participantResult, myParticipantResult, scoresResult, playersResult] = await Promise.all([
    adminClient.from('draft_picks').select('player_id, player_name, participant_id').eq('draft_id', draft.id),
    adminClient.from('draft_participants').select('id, team_name, user_id').eq('draft_id', draft.id),
    adminClient.from('draft_participants').select('id').eq('draft_id', draft.id).eq('user_id', user.id).limit(1),
    adminClient.from('player_scores').select('player_id, score_date, goals, assists, points').eq('draft_id', draft.id),
    adminClient.from('players').select('id, name, team, position'),
  ]);

  const picks = picksResult.data || [];
  const participants = participantResult.data || [];
  const myParticipant = myParticipantResult.data?.[0];
  const scores = scoresResult.data || [];
  const players = playersResult.data || [];

  if (!myParticipant) {
    return NextResponse.json({ draft: { id: draft.id, name: draft.name, status: draft.status }, rank: null });
  }

  const playerMap = new Map<string, { name: string; team: string; position: string }>();
  for (const p of players) {
    playerMap.set(p.id, { name: p.name, team: p.team, position: p.position });
  }

  const scoresByPlayer = new Map<string, Map<string, { goals: number; assists: number; points: number }>>();
  for (const s of scores) {
    if (!scoresByPlayer.has(s.player_id)) scoresByPlayer.set(s.player_id, new Map());
    scoresByPlayer.get(s.player_id)!.set(s.score_date, { goals: s.goals, assists: s.assists, points: s.points });
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const todayET = `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
  const yesterdayDate = new Date(`${todayET}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const teamTotals = new Map<string, number>();
  const teamByParticipant = new Map<string, string>();
  for (const p of participants) {
    teamByParticipant.set(p.id, p.team_name);
    teamTotals.set(p.id, 0);
  }

  const picksByParticipant = new Map<string, typeof picks>();
  for (const pick of picks) {
    if (!picksByParticipant.has(pick.participant_id)) picksByParticipant.set(pick.participant_id, []);
    picksByParticipant.get(pick.participant_id)!.push(pick);

    const playerScores = scoresByPlayer.get(pick.player_id);
    let total = 0;
    if (playerScores) {
      for (const [, ds] of playerScores) total += ds.points;
    }
    teamTotals.set(pick.participant_id, (teamTotals.get(pick.participant_id) || 0) + total);
  }

  const standings = [...teamTotals.entries()]
    .map(([participantId, totalPoints]) => ({
      participantId,
      teamName: teamByParticipant.get(participantId) || 'Unknown',
      totalPoints,
      isYou: participantId === myParticipant.id,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const rank = standings.findIndex(s => s.isYou) + 1;

  const myPicks = picksByParticipant.get(myParticipant.id) || [];
  const roster = myPicks.map(pick => {
    const player = playerMap.get(pick.player_id);
    const playerScores = scoresByPlayer.get(pick.player_id);
    let totalPoints = 0;
    let yesterdayPoints = 0;
    if (playerScores) {
      for (const [, ds] of playerScores) totalPoints += ds.points;
      const yd = playerScores.get(yesterdayStr);
      if (yd) yesterdayPoints = yd.points;
    }
    return {
      playerId: pick.player_id,
      playerName: player?.name || pick.player_name,
      team: player?.team || '',
      position: player?.position || '',
      totalPoints,
      yesterdayPoints,
    };
  });

  const totalPoints = roster.reduce((sum, r) => sum + r.totalPoints, 0);
  const yesterdayTotal = roster.reduce((sum, r) => sum + r.yesterdayPoints, 0);

  const [espnInjuries, activePlayoffTeams, tonightGames] = await Promise.all([
    fetchEspnInjuries(),
    fetchActivePlayoffTeams(),
    fetchTonightGames(),
  ]);

  const rosterWithStatus = roster.map(r => {
    const live = espnInjuries.get(r.playerName.toLowerCase());
    const isEliminated = !activePlayoffTeams.has(r.team) && activePlayoffTeams.size > 0;
    return {
      ...r,
      injuryStatus: live?.status || 'healthy',
      injuryDescription: live?.description || null,
      isEliminated,
    };
  });

  const tonightTeams = new Set(tonightGames.flatMap(g => [g.away, g.home]));
  const activePlayerCount = rosterWithStatus.filter(r => tonightTeams.has(r.team)).length;

  const isPlayoffs = draft.season_type === 'playoffs';
  const allPlayoffTeams = new Set<string>();
  const eliminatedTeamsSet = new Set<string>();
  if (isPlayoffs) {
    try {
      const bracketRes = await fetch("https://api-web.nhle.com/v1/playoff-bracket/2026");
      if (bracketRes.ok) {
        const bracketData = await bracketRes.json();
        for (const series of bracketData.series || []) {
          const top = series.topSeedTeam?.abbrev;
          const bottom = series.bottomSeedTeam?.abbrev;
          if (top && top !== "TBD") allPlayoffTeams.add(top);
          if (bottom && bottom !== "TBD") allPlayoffTeams.add(bottom);
          if (series.winningTeamId && series.losingTeamId) {
            if (series.topSeedTeam?.id === series.losingTeamId && top) eliminatedTeamsSet.add(top);
            if (series.bottomSeedTeam?.id === series.losingTeamId && bottom) eliminatedTeamsSet.add(bottom);
          }
        }
      }
    } catch {}
  }

  const isAdmin = draft.admin_user_id === user.id;

  return NextResponse.json({
    draft: {
      id: draft.id,
      name: draft.name,
      status: draft.status,
      seasonType: draft.season_type,
      scoringFormat: draft.scoring_format,
    },
    isAdmin,
    rank,
    totalTeams: participants.length,
    totalPoints,
    yesterdayPoints: yesterdayTotal,
    roster: rosterWithStatus,
    standings: standings.slice(0, 5),
    tonightGames: tonightGames.map(g => ({
      away: g.away,
      home: g.home,
      awayLogo: g.awayLogo,
      homeLogo: g.homeLogo,
      time: g.time,
    })),
    activePlayerCount,
    eliminatedTeams: [...eliminatedTeamsSet],
    totalPlayoffTeams: allPlayoffTeams.size,
  });
}
