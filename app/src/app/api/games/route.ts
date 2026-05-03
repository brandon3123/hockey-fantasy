import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { fetchTonightGames } from '@/lib/nhl-api';

export async function GET() {
  const tonightGames = await fetchTonightGames();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      games: tonightGames.map(g => ({
        away: g.away,
        home: g.home,
        awayLogo: g.awayLogo,
        homeLogo: g.homeLogo,
        time: g.time,
        yourPlayers: [],
      })),
      totalYourPlayers: 0,
    });
  }

  const { data: drafts } = await supabase
    .from('drafts')
    .select('id')
    .eq('admin_user_id', user.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: participations } = await supabase
    .from('draft_participants')
    .select('draft_id')
    .eq('user_id', user.id);

  const participatedDraftIds = new Set((participations || []).map(p => p.draft_id));
  let draftId: string | null = null;

  if (drafts && drafts.length > 0) {
    draftId = drafts[0].id;
  } else if (participatedDraftIds.size > 0) {
    const { data: joinedDrafts } = await supabase
      .from('drafts')
      .select('id')
      .in('id', [...participatedDraftIds])
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);
    draftId = joinedDrafts?.[0]?.id || null;
  }

  if (!draftId) {
    return NextResponse.json({
      games: tonightGames.map(g => ({
        away: g.away,
        home: g.home,
        awayLogo: g.awayLogo,
        homeLogo: g.homeLogo,
        time: g.time,
        yourPlayers: [],
      })),
      totalYourPlayers: 0,
    });
  }

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll() { return []; }, setAll() {} },
    }
  );

  const { data: myParticipant } = await adminClient
    .from('draft_participants')
    .select('id')
    .eq('draft_id', draftId)
    .eq('user_id', user.id)
    .limit(1);

  if (!myParticipant || myParticipant.length === 0) {
    return NextResponse.json({
      games: tonightGames.map(g => ({
        away: g.away,
        home: g.home,
        awayLogo: g.awayLogo,
        homeLogo: g.homeLogo,
        time: g.time,
        yourPlayers: [],
      })),
      totalYourPlayers: 0,
    });
  }

  const [picksResult, playersResult] = await Promise.all([
    adminClient.from('draft_picks').select('player_id').eq('draft_id', draftId).eq('participant_id', myParticipant[0].id),
    adminClient.from('players').select('id, name, team, position'),
  ]);

  const myPlayerIds = new Set((picksResult.data || []).map(p => p.player_id));
  const playerMap = new Map<string, { name: string; team: string; position: string }>();
  for (const p of playersResult.data || []) {
    playerMap.set(p.id, { name: p.name, team: p.team, position: p.position });
  }

  const tonightTeams = new Set(tonightGames.flatMap(g => [g.away, g.home]));
  const rosteredByTeam = new Map<string, Array<{ playerName: string; position: string }>>();
  for (const playerId of myPlayerIds) {
    const player = playerMap.get(playerId);
    if (!player || !tonightTeams.has(player.team)) continue;
    if (!rosteredByTeam.has(player.team)) rosteredByTeam.set(player.team, []);
    rosteredByTeam.get(player.team)!.push({ playerName: player.name, position: player.position });
  }

  let totalYourPlayers = 0;
  const games = tonightGames.map(g => {
    const awayPlayers = rosteredByTeam.get(g.away) || [];
    const homePlayers = rosteredByTeam.get(g.home) || [];
    const yourPlayers = [...awayPlayers, ...homePlayers];
    totalYourPlayers += yourPlayers.length;
    return {
      away: g.away,
      home: g.home,
      awayLogo: g.awayLogo,
      homeLogo: g.homeLogo,
      time: g.time,
      yourPlayers,
    };
  });

  return NextResponse.json({ games, totalYourPlayers });
}
