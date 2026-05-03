'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useDraftState, DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import { Player } from '@/types/player';
import TeamLogo from '@/components/TeamLogo';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LabelList,
} from 'recharts';

interface Standing {
  participant: ParticipantData;
  totalPts: number;
  roster: { player: Player; round: number }[];
}

function computeStandings(
  participants: ParticipantData[],
  picks: DraftPickRow[],
  players: Player[]
): Standing[] {
  return participants
    .map((participant) => {
      const myPicks = picks.filter((p) => p.participant_id === participant.id);
      const roster = myPicks
        .map((pick) => {
          const player = players.find(
            (pl) =>
              `${pl.name}-${pl.team}-${pl.position}`
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-') === pick.player_id
          );
          return player ? { player, round: pick.round } : null;
        })
        .filter((x): x is { player: Player; round: number } => x !== null);
      const totalPts = roster.reduce((sum, r) => sum + r.player.displayPoints, 0);
      return { participant, totalPts, roster };
    })
    .sort((a, b) => b.totalPts - a.totalPts);
}

function computeAwards(
  standings: Standing[],
  picks: DraftPickRow[],
  participants: ParticipantData[]
) {
  const allRostered = standings.flatMap((s) =>
    s.roster.map((r) => ({ ...r, participant: s.participant }))
  );

  const mvp = allRostered.length > 0
    ? allRostered.reduce((best, cur) =>
        cur.player.displayPoints > best.player.displayPoints ? cur : best
      , allRostered[0])
    : null;

  const withAdp = allRostered.filter((r) => r.player.adp != null);

  const bestPick = withAdp.length > 0
    ? withAdp.reduce((best, cur) => {
        const curDiff = (cur.player.adp ?? 0) - cur.round;
        const bestDiff = (best.player.adp ?? 0) - best.round;
        return curDiff > bestDiff ? cur : best;
      }, withAdp[0])
    : null;

  const worstPick = withAdp.length > 0
    ? withAdp.reduce((worst, cur) => {
        const curDiff = cur.round - (cur.player.adp ?? 0);
        const worstDiff = worst.round - (worst.player.adp ?? 0);
        return curDiff > worstDiff ? cur : worst;
      }, withAdp[0])
    : null;

  const lastPick = picks.length > 0 ? picks[picks.length - 1] : null;

  const mrIrrelevant = lastPick
    ? (() => {
        const player = allRostered.find(
          (r) =>
            `${r.player.name}-${r.player.team}-${r.player.position}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-') === lastPick.player_id
        );
        const participant = participants.find((p) => p.id === lastPick.participant_id);
        return player ? { ...player, pickEntry: lastPick, participant: participant ?? null } : null;
      })()
    : null;

  return { mvp, bestPick, worstPick, mrIrrelevant };
}

function computeTeamDistribution(standings: Standing[]) {
  const counts: Record<string, number> = {};
  standings.forEach((s) => {
    s.roster.forEach((r) => {
      counts[r.player.team] = (counts[r.player.team] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count);
}

function computePositionBreakdown(standings: Standing[]) {
  const counts: Record<string, number> = {};
  standings.forEach((s) => {
    s.roster.forEach((r) => {
      counts[r.player.position] = (counts[r.player.position] || 0) + 1;
    });
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const colors: Record<string, string> = { C: '#6b9b7a', LW: '#ffd700', RW: '#c8102e', D: '#4a90d9' };
  return Object.entries(counts).map(([pos, count]) => ({
    name: pos,
    value: count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
    fill: colors[pos] || '#4a7c59',
  }));
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const NHL_TEAM_COLORS: Record<string, string> = {
  ANA: '#85714D', BOS: '#FFB81C', BUF: '#002654', CAR: '#CC0000',
  CBJ: '#002654', CGY: '#C8102E', CHI: '#CF0A2C', COL: '#6F263D',
  DAL: '#006847', DET: '#C8102E', EDM: '#041E42', FLA: '#041E42',
  LAK: '#111111', MIN: '#A6192E', MTL: '#AF1E2D', NJD: '#CE1126',
  NSH: '#FFB81C', NYI: '#00539B', NYR: '#0038A8', OTT: '#C8102E',
  PHI: '#F74902', PIT: '#000000', SEA: '#001F3F', SJS: '#006D75',
  STL: '#002F87', TBL: '#00205B', TOR: '#00205B', UTA: '#14808C',
  VAN: '#00205B', VGK: '#B4975A', WPG: '#041E42', WSH: '#041E42',
};

const NHL_ESPN_SLUGS: Record<string, string> = {
  ANA: 'ana', BOS: 'bos', BUF: 'buf', CAR: 'car', CBJ: 'cbj', CGY: 'cgy',
  CHI: 'chi', COL: 'col', DAL: 'dal', DET: 'det', EDM: 'edm', FLA: 'fla',
  LAK: 'la', MIN: 'min', MTL: 'mtl', NJD: 'nj', NSH: 'nsh', NYI: 'nyi',
  NYR: 'nyr', OTT: 'ott', PHI: 'phi', PIT: 'pit', SEA: 'sea', SJS: 'sj',
  STL: 'stl', TBL: 'tb', TOR: 'tor', UTA: 'uta', VAN: 'van', VGK: 'vgk',
  WPG: 'wpg', WSH: 'wsh',
};

function AwardCard({
  icon,
  label,
  color,
  player,
  round,
  participant,
  subtitle,
}: {
  icon: string;
  label: string;
  color: string;
  player: Player;
  round: number;
  participant?: ParticipantData | null;
  subtitle?: string;
}) {
  return (
    <div style={{ borderColor: color }} className="bg-[#0a0f0a] border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color }}>{icon} {label}</div>
      <div className="flex items-center gap-2">
        <TeamLogo team={player.team} className="w-6 h-6" />
        <div>
          <div className="font-bold text-[#c8d9c3] text-sm">{player.name}</div>
          <div className="text-[11px] text-[#5a6b57]">
            {player.position} &bull; {player.displayPoints.toFixed(1)} pts &bull; {player.pointsPerGame.toFixed(2)} ppg
            {subtitle && <> &bull; {subtitle}</>}
          </div>
        </div>
      </div>
      {participant && (
        <div className="text-[11px] text-[#6b9b7a] mt-2">
          Drafted by {participant.team_name} (R{round})
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const draftId = params.id as string;
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [liveInjuries, setLiveInjuries] = useState<Map<string, { status: string; description: string | null }>>(new Map());
  const [eliminatedTeams, setEliminatedTeams] = useState<Set<string>>(new Set());

  const {
    draft,
    participants,
    picks,
    players,
    loading,
    isDraftComplete,
  } = useDraftState(draftId);

  const standings = useMemo(
    () => (draft ? computeStandings(participants, picks, players) : []),
    [participants, picks, players, draft]
  );

  const awards = useMemo(
    () => (standings.length > 0 ? computeAwards(standings, picks, participants) : null),
    [standings, picks, participants]
  );

  const teamDistribution = useMemo(
    () => computeTeamDistribution(standings),
    [standings]
  );

  const positionBreakdown = useMemo(
    () => computePositionBreakdown(standings),
    [standings]
  );

  useEffect(() => {
    async function fetchLiveData() {
      try {
        const [injuriesRes, bracketRes] = await Promise.all([
          fetch('/api/live-injuries'),
          fetch('/api/playoff-bracket'),
        ]);
        if (injuriesRes.ok) {
          const injuriesData = await injuriesRes.json();
          const map = new Map<string, { status: string; description: string | null }>();
          for (const [name, info] of Object.entries(injuriesData)) {
            map.set(name, info as { status: string; description: string | null });
          }
          setLiveInjuries(map);
        }
        if (bracketRes.ok) {
          const bracketData = await bracketRes.json();
          const active = new Set<string>();
          for (const series of bracketData.series || []) {
            if (series.topSeedTeam?.abbrev && series.topSeedTeam.abbrev !== 'TBD') active.add(series.topSeedTeam.abbrev);
            if (series.bottomSeedTeam?.abbrev && series.bottomSeedTeam.abbrev !== 'TBD') active.add(series.bottomSeedTeam.abbrev);
          }
          if (active.size > 0) {
            const allTeams = new Set(standings.flatMap(s => s.roster.map(r => r.player.team)));
            const eliminated = new Set<string>();
            for (const team of allTeams) {
              if (team && !active.has(team)) eliminated.add(team);
            }
            setEliminatedTeams(eliminated);
          }
        }
      } catch {}
    }
    if (draft && isDraftComplete) fetchLiveData();
  }, [draft, isDraftComplete, standings]);

  const totalPicks = picks.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57]">Loading results...</div>
      </div>
    );
  }

  if (!draft || !isDraftComplete) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#5a6b57] text-lg mb-2">Results not available</div>
          <Link href="/" className="text-sm text-[#6b9b7a] hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm text-[#5a6b57] hover:text-[#c8d9c3]">&larr; Back to Dashboard</Link>

        <div className="flex flex-wrap justify-between items-start gap-2 mt-2 mb-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#5a6b57] mb-1">Draft Complete</div>
            <h1 className="text-xl md:text-2xl font-bold text-[#c8d9c3]">{draft.name}</h1>
            <div className="text-sm text-[#5a6b57] mt-1">
              {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'} &bull; {participants.length} Managers &bull; {draft.players_per_team} Rounds
            </div>
          </div>
          <div className="bg-[#4a7c59] text-[#c8d9c3] px-4 py-2 rounded-lg font-bold text-sm">
            🏆 FINAL RESULTS
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">Standings</h2>
          <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#4a7c59] text-[#c8d9c3]">
                  <th className="px-3 py-2 text-left font-semibold border-r border-[#3d664a]">RANK</th>
                  <th className="px-3 py-2 text-left font-semibold border-r border-[#3d664a]">TEAM</th>
                  <th className="px-3 py-2 text-center font-semibold border-r border-[#3d664a]">ROSTER</th>
                  <th className="px-3 py-2 text-right font-semibold">TOTAL PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const isFirst = i === 0;
                  return (
                    <tr key={s.participant.id} className={`border-b border-[#141e12] ${isFirst ? 'bg-[#1a3d1a]' : 'bg-[#050a05]'}`}>
                      <td className={`px-3 py-2 font-bold ${i < 3 ? (i === 0 ? 'text-[#ffd700]' : i === 1 ? 'text-[#c0c0c0]' : 'text-[#cd7f32]') : 'text-[#5a6b57]'}`}>
                        {i < 3 ? RANK_MEDALS[i] : ''} {i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}
                      </td>
                      <td className={`px-3 py-2 font-bold ${isFirst ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                        {s.participant.team_name}
                      </td>
                      <td className="px-3 py-2 text-center text-[#5a6b57]">
                        {s.roster.length} players
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${isFirst ? 'text-[#6b9b7a] text-base' : 'text-[#c8d9c3]'}`}>
                        {s.totalPts.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">Team Rosters</h2>
          {standings.map((s, i) => {
            const isExpanded = expandedTeam === s.participant.id || (expandedTeam === null && i === 0);
            const isFirst = i === 0;
            return (
              <div
                key={s.participant.id}
                className={`bg-[#0a0f0a] rounded-lg mb-2 overflow-hidden border ${isFirst ? 'border-[#4a7c59]' : 'border-[#141e12]'}`}
              >
                <button
                  onClick={() => setExpandedTeam(expandedTeam === s.participant.id ? '' : s.participant.id)}
                  className="w-full px-4 py-3 flex justify-between items-center border-b border-[#141e12] text-left"
                >
                  <div className="flex items-center gap-2">
                    {i < 3 && <span>{RANK_MEDALS[i]}</span>}
                    <span className={`font-bold ${isFirst ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                      {s.participant.team_name}
                    </span>
                    {!isExpanded && (
                      <span className="text-[11px] text-[#5a6b57] ml-2">{s.roster.length} players</span>
                    )}
                  </div>
                  <span className={`font-bold ${isFirst ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                    {s.totalPts.toFixed(1)} pts
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-4 py-2">
                    {s.roster
                      .sort((a, b) => a.round - b.round)
                      .map((r) => {
                      const liveInjury = liveInjuries.get(r.player.name.toLowerCase());
                      const injuryStatus = liveInjury?.status ?? r.player.injury.status;
                      const isEliminated = eliminatedTeams.has(r.player.team);
                      const isOut = injuryStatus === "out indefinitely" || injuryStatus === "out for playoffs";
                      const isInactive = isOut || isEliminated;
                      const injuryLabel =
                        injuryStatus === "day-to-day" ? "DTD" :
                        injuryStatus === "week-to-week" ? "WTW" :
                        (injuryStatus === "out indefinitely" || injuryStatus === "out for playoffs") ? "OUT" : null;
                      const injuryBadgeColor =
                        injuryStatus === "day-to-day" ? "bg-[#854d0e] text-[#fbbf24]" :
                        injuryStatus === "week-to-week" ? "bg-[#9a3412] text-[#fb923c]" :
                        "bg-[#7f1d1d] text-[#fca5a5]";

                      return (
                        <div
                          key={`${r.player.name}-${r.player.team}-${r.player.position}`}
                          className={`flex justify-between items-center py-2 border-b border-[#141e12] last:border-0 ${isInactive ? "opacity-40" : ""}`}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#5a6b57] w-6">R{r.round}</span>
                            <TeamLogo team={r.player.team} className="w-5 h-5" />
                            <span className={`font-semibold ${isEliminated ? "text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2" : "text-[#c8d9c3]"}`}>
                              {r.player.name}
                            </span>
                            <span className="text-[#5a6b57]">{r.player.position} &bull; {r.player.pointsPerGame.toFixed(2)} ppg</span>
                            {injuryLabel && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${injuryBadgeColor}`}>
                                {injuryLabel}
                              </span>
                            )}
                          </div>
                          <span className="text-[#6b9b7a] font-bold text-xs">{r.player.displayPoints.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {awards && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">Draft Awards</h2>
            <div className="grid grid-cols-2 gap-3">
              {awards.mvp && (
                <AwardCard
                  icon="⭐"
                  label="MVP"
                  color="#ffd700"
                  player={awards.mvp.player}
                  round={awards.mvp.round}
                  participant={awards.mvp.participant}
                />
              )}
              {awards.bestPick && (
                <AwardCard
                  icon="💎"
                  label="Best Pick"
                  color="#6b9b7a"
                  player={awards.bestPick.player}
                  round={awards.bestPick.round}
                  participant={awards.bestPick.participant}
                  subtitle={`ADP ${awards.bestPick.player.adp?.toFixed(1)}`}
                />
              )}
              {awards.worstPick && (
                <AwardCard
                  icon="😬"
                  label="Worst Pick"
                  color="#9b6b6b"
                  player={awards.worstPick.player}
                  round={awards.worstPick.round}
                  participant={awards.worstPick.participant}
                  subtitle={`ADP ${awards.worstPick.player.adp?.toFixed(1)}`}
                />
              )}
              {awards.mrIrrelevant && (
                <AwardCard
                  icon="🔔"
                  label="Mr. Irrelevant"
                  color="#5a6b57"
                  player={awards.mrIrrelevant.player}
                  round={awards.mrIrrelevant.pickEntry.round}
                  participant={awards.mrIrrelevant.participant}
                />
              )}
            </div>
          </div>
        )}

        {teamDistribution.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">Draft Stats</h2>

            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4 mb-3">
              <div className="text-xs font-bold text-[#c8d9c3] mb-3">Players Drafted by NHL Team</div>
              <ResponsiveContainer width="100%" height={teamDistribution.length * 44}>
                <BarChart data={teamDistribution} layout="vertical" margin={{ left: 60, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="team"
                    type="category"
                    tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => {
                      const team = payload.value;
                      return (
                        <g transform={`translate(${Number(x) - 58}, ${y})`}>
                          <image
                            href={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/${NHL_ESPN_SLUGS[team] || team.toLowerCase()}.png`}
                            x={0}
                            y={-10}
                            width={20}
                            height={20}
                            onError={(e) => { (e.target as SVGImageElement).style.display = 'none'; }}
                          />
                          <text x={24} y={4} fill="#c8d9c3" fontSize={12} fontWeight="bold" textAnchor="start">
                            {team}
                          </text>
                        </g>
                      );
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0a0f0a', border: '1px solid #141e12', borderRadius: '6px', fontSize: 12 }}
                    labelStyle={{ color: '#c8d9c3' }}
                    itemStyle={{ color: '#6b9b7a' }}
                    formatter={(value) => [`${value} players`, 'Drafted']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {teamDistribution.map((entry, index) => (
                      <Cell key={index} fill={NHL_TEAM_COLORS[entry.team] || '#4a7c59'} />
                    ))}
                    <LabelList dataKey="count" position="right" fill="#6b9b7a" fontSize={12} fontWeight="bold" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {positionBreakdown.length > 0 && (
              <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4">
                <div className="text-xs font-bold text-[#c8d9c3] mb-3">Position Breakdown</div>
                <div className="flex flex-col md:flex-row items-center justify-center">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie
                        data={positionBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        dataKey="value"
                        stroke="none"
                      >
                        {positionBreakdown.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="md:ml-6 mt-4 md:mt-0 text-xs">
                    <div className="text-center mb-2">
                      <div className="text-xl font-bold text-[#c8d9c3]">{totalPicks}</div>
                      <div className="text-xs text-[#5a6b57]">total picks</div>
                    </div>
                    {positionBreakdown.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2 mb-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: entry.fill }} />
                        <span className="text-[#c8d9c3]">{entry.name} — {entry.value} ({entry.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
