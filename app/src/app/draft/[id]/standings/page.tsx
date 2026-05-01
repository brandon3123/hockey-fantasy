'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';

interface DraftInfo {
  id: string;
  name: string;
  season_type: string;
  players_per_team: number;
  scoring_format: string;
}

interface RosterPlayer {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  round: number;
  goals: number;
  assists: number;
  points: number;
  gamesPlayed: number;
}

interface StandingEntry {
  participantId: string;
  userId: string;
  teamName: string;
  rank: number;
  totalPoints: number;
  yesterdayPoints: number;
  gamesBehind: number;
  trend7Day: number[];
  roster: RosterPlayer[];
}

interface TonightGame {
  gameId: number;
  away: string;
  home: string;
  time: string;
  hasDraftedPlayers: boolean;
}

interface StandingsData {
  draft: DraftInfo;
  standings: StandingEntry[];
  tonightGames: TonightGame[];
  yesterday: string;
  currentUserId: string | null;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

function getDraftedPlayersForGame(
  game: TonightGame,
  standings: StandingEntry[],
  currentUserId: string | null
): { playerName: string; position: string; team: string }[] {
  const players: { playerName: string; position: string; team: string }[] = [];
  const myTeam = currentUserId
    ? standings.find((s) => s.userId === currentUserId)
    : null;
  if (!myTeam) return players;
  for (const p of myTeam.roster) {
    if (p.team === game.home || p.team === game.away) {
      players.push({ playerName: p.playerName, position: p.position, team: p.team });
    }
  }
  return players;
}

export default function StandingsPage() {
  const params = useParams();
  const draftId = params.id as string;
  const [data, setData] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [expandedGame, setExpandedGame] = useState<number | null>(null);

  useEffect(() => {
    async function fetchStandings() {
      try {
        const res = await fetch(`/api/drafts/${draftId}/standings`);
        if (!res.ok) {
          const body = await res.json();
          setError(body.error || 'Failed to load standings');
          return;
        }
        setData(await res.json());
      } catch {
        setError('Failed to load standings');
      } finally {
        setLoading(false);
      }
    }
    fetchStandings();
  }, [draftId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57]">Loading standings...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#5a6b57] text-lg mb-2">{error || 'Standings not available'}</div>
          <Link href="/" className="text-sm text-[#6b9b7a] hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { draft, standings, tonightGames } = data;

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm text-[#5a6b57] hover:text-[#c8d9c3]">
          &larr; Back to Dashboard
        </Link>

        <div className="flex flex-wrap justify-between items-start gap-2 mt-2 mb-8">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#5a6b57] mb-1">
              Season Standings
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[#c8d9c3]">{draft.name}</h1>
            <div className="text-sm text-[#5a6b57] mt-1">
              {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'} &bull;{' '}
              {standings.length} Managers &bull; {draft.players_per_team} Rounds
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/draft/${draftId}/results`}
              className="px-3 py-2 text-xs font-medium text-[#c8d9c3] bg-[#0a0f0a] border border-[#141e12] rounded-lg hover:bg-[#141e12] hover:border-[#4a7c59] transition-colors"
            >
              Draft Recap
            </Link>
            <div className="bg-[#4a7c59] text-[#c8d9c3] px-4 py-2 rounded-lg font-bold text-sm">
              STANDINGS
            </div>
          </div>
        </div>

        {tonightGames.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">
              Tonight&apos;s Games
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {tonightGames.map((game) => {
                const draftedPlayers = getDraftedPlayersForGame(game, standings, data.currentUserId);
                const hasPlayers = game.hasDraftedPlayers && draftedPlayers.length > 0;
                const isExpanded = expandedGame === game.gameId;

                return (
                  <div
                    key={game.gameId}
                    onClick={() => {
                      if (hasPlayers) {
                        setExpandedGame(isExpanded ? null : game.gameId);
                      }
                    }}
                    className={`shrink-0 rounded-lg p-3 cursor-pointer transition-all ${
                      hasPlayers
                        ? 'border-2 border-[#4a7c59] bg-[#0a0f0a]'
                        : 'border border-[#141e12] bg-[#0a0f0a] cursor-default'
                    }`}
                    style={{ minWidth: '160px' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogo team={game.home} className="w-6 h-6" />
                        <span
                          className={`text-xs font-semibold ${
                            hasPlayers ? 'text-[#c8d9c3]' : 'text-[#5a6b57]'
                          }`}
                        >
                          {game.home}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-[#5a6b57]">vs</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogo team={game.away} className="w-6 h-6" />
                        <span
                          className={`text-xs font-semibold ${
                            hasPlayers ? 'text-[#c8d9c3]' : 'text-[#5a6b57]'
                          }`}
                        >
                          {game.away}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`text-[10px] text-center mt-2 ${
                        hasPlayers ? 'text-[#5a6b57]' : 'text-[#2d3c28]'
                      }`}
                    >
                      {game.time}
                    </div>
                    {hasPlayers && (
                      <div className="mt-2 text-center">
                        <span className="inline-block px-2 py-0.5 bg-[#4a7c59] text-[#c8d9c3] text-[10px] font-bold rounded">
                          {draftedPlayers.length} PLAYER{draftedPlayers.length !== 1 ? 'S' : ''}
                        </span>
                      </div>
                    )}
                    {isExpanded && hasPlayers && (
                      <div className="border-t border-[#141e12] mt-2 pt-2">
                        {draftedPlayers.map((p, i) => (
                          <div
                            key={`${p.playerName}-${p.team}-${i}`}
                            className="flex items-center gap-1.5 py-0.5"
                          >
                            <TeamLogo team={p.team} className="w-3.5 h-3.5" />
                            <span className="text-[10px] text-[#c8d9c3]">{p.playerName}</span>
                            <span className="text-[10px] text-[#5a6b57]">{p.position}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">
            Standings
          </h2>
          <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#4a7c59] text-[#c8d9c3]">
                  <th className="px-3 py-2 text-left font-semibold border-r border-[#3d664a]">
                    RANK
                  </th>
                  <th className="px-3 py-2 text-left font-semibold border-r border-[#3d664a]">
                    TEAM
                  </th>
                  <th className="px-3 py-2 text-right font-semibold border-r border-[#3d664a]">
                    PTS
                  </th>
                  <th className="px-3 py-2 text-center font-semibold border-r border-[#3d664a]">
                    YESTERDAY
                  </th>
                  <th className="px-3 py-2 text-center font-semibold border-r border-[#3d664a]">
                    7-DAY
                  </th>
                  <th className="px-3 py-2 text-right font-semibold">GB</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => {
                  const isFirst = s.rank === 1;
                  const isExpanded = expandedTeam === s.participantId;
                  const maxTrend = Math.max(...s.trend7Day, 1);

                  return (
                    <>
                      <tr
                        key={s.participantId}
                        onClick={() =>
                          setExpandedTeam(isExpanded ? null : s.participantId)
                        }
                        className={`border-b border-[#141e12] cursor-pointer hover:bg-[#0f1a0f] transition-colors ${
                          isFirst ? 'bg-[#1a3d1a]' : 'bg-[#050a05]'
                        }`}
                      >
                        <td
                          className="px-3 py-2 font-bold text-[#5a6b57]"
                          style={s.rank <= 3 ? { color: RANK_COLORS[s.rank - 1] } : undefined}
                        >
                          {s.rank <= 3 ? RANK_MEDALS[s.rank - 1] : ''} {s.rank}
                        </td>
                        <td
                          className={`px-3 py-2 font-bold ${
                            isFirst ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'
                          }`}
                        >
                          {s.teamName}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-bold ${
                            isFirst ? 'text-[#6b9b7a] text-sm' : 'text-[#c8d9c3]'
                          }`}
                        >
                          {s.totalPoints.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {s.yesterdayPoints > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 bg-[#1a3d1a] text-[#6b9b7a] text-[10px] font-bold rounded">
                              +{s.yesterdayPoints.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[#5a6b57]">0</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-end gap-0.5 justify-center h-4">
                            {s.trend7Day.map((val, i) => {
                              const height = Math.max((val / maxTrend) * 16, 2);
                              const isLast = i === s.trend7Day.length - 1;
                              return (
                                <div
                                  key={i}
                                  className={`w-2 rounded-sm ${
                                    isLast ? 'bg-[#6b9b7a]' : 'bg-[#4a7c59]'
                                  }`}
                                  style={{ height: `${height}px` }}
                                  title={`${val} pts`}
                                />
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-[#5a6b57]">
                          {s.gamesBehind === 0 ? '-' : s.gamesBehind.toFixed(1)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${s.participantId}-roster`}>
                          <td colSpan={6} className="px-3 py-3 bg-[#050a05] border-b border-[#141e12]">
                            <div className="grid gap-1.5">
                              {s.roster
                                .sort((a, b) => a.round - b.round)
                                .map((p) => (
                                  <div
                                    key={p.playerId}
                                    className="flex items-center justify-between text-xs py-1"
                                  >
          <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[#5a6b57] w-5 text-right">
                                        {p.round}
                                      </span>
                                      <TeamLogo team={p.team} className="w-4 h-4" />
                                      <span className="text-[#c8d9c3] font-medium">
                                        {p.playerName}
                                      </span>
                                      <span className="text-[#5a6b57]">{p.position}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[#6b9b7a] font-bold">
                                        {p.points.toFixed(1)}
                                      </span>
                                      <span className="text-[#5a6b57] w-6 text-right">
                                        {p.goals}G
                                      </span>
                                      <span className="text-[#5a6b57] w-6 text-right">
                                        {p.assists}A
                                      </span>
                                      <span className="text-[#2d3c28] w-6 text-right">
                                        {p.gamesPlayed}GP
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
