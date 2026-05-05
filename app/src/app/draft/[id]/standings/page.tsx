'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';
import { ActionLink } from '@/components/ActionButton';

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
  injuryStatus: "healthy" | "day-to-day" | "week-to-week" | "out indefinitely" | "out for playoffs";
  injuryDescription: string | null;
  isEliminated: boolean;
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

interface DraftedPlayerInfo {
  playerName: string;
  position: string;
  team: string;
  injuryStatus: RosterPlayer["injuryStatus"];
}

function getDraftedPlayersForGame(
  game: TonightGame,
  standings: StandingEntry[],
  currentUserId: string | null
): DraftedPlayerInfo[] {
  const players: DraftedPlayerInfo[] = [];
  const myTeam = currentUserId
    ? standings.find((s) => s.userId === currentUserId)
    : null;
  if (!myTeam) return players;
  for (const p of myTeam.roster) {
    if (p.team === game.home || p.team === game.away) {
      players.push({ playerName: p.playerName, position: p.position, team: p.team, injuryStatus: p.injuryStatus });
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
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/drafts/${draftId}/standings?tz=${encodeURIComponent(tz)}`);
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3] mb-2">{draft.name}</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-[#5a6b57]">
            <span>{draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{standings.length} Managers</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{draft.players_per_team} Rounds</span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <ActionLink
              href={`/draft/${draftId}/results`}
              variant="secondary"
              className="px-4 py-2 text-sm"
            >
              Draft Recap
            </ActionLink>
          </div>
        </div>

        {tonightGames.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">
                Tonight&apos;s Games
              </h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 justify-center">
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
                    className={`shrink-0 rounded-lg p-3 transition-all ${
                      hasPlayers
                        ? 'border border-[#4a7c59] bg-[#0a0f0a] cursor-pointer hover:border-[#6b9b7a]'
                        : 'border border-[#141e12] bg-[#0a0f0a] cursor-default'
                    }`}
                    style={{ minWidth: '160px' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogo team={game.home} className="w-6 h-6" />
                        <span className={`text-xs font-semibold ${hasPlayers ? 'text-[#c8d9c3]' : 'text-[#5a6b57]'}`}>
                          {game.home}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-[#5a6b57]">vs</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogo team={game.away} className="w-6 h-6" />
                        <span className={`text-xs font-semibold ${hasPlayers ? 'text-[#c8d9c3]' : 'text-[#5a6b57]'}`}>
                          {game.away}
                        </span>
                      </div>
                    </div>
                    <div className={`text-[10px] text-center mt-2 ${hasPlayers ? 'text-[#5a6b57]' : 'text-[#2d3c28]'}`}>
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
                        {draftedPlayers.map((p, i) => {
                          const injuryLabel =
                            p.injuryStatus === "day-to-day" ? "DTD" :
                            p.injuryStatus === "week-to-week" ? "WTW" :
                            (p.injuryStatus === "out indefinitely" || p.injuryStatus === "out for playoffs") ? "OUT" : null;
                          const injuryBadgeColor =
                            p.injuryStatus === "day-to-day" ? "bg-[#854d0e] text-[#fbbf24]" :
                            p.injuryStatus === "week-to-week" ? "bg-[#9a3412] text-[#fb923c]" :
                            "bg-[#7f1d1d] text-[#fca5a5]";

                          return (
                            <div key={`${p.playerName}-${p.team}-${i}`} className="flex items-center gap-1.5 py-0.5">
                              <TeamLogo team={p.team} className="w-3.5 h-3.5" />
                              <span className="text-[10px] text-[#c8d9c3]">{p.playerName}</span>
                              <span className="text-[10px] text-[#5a6b57]">{p.position}</span>
                              {injuryLabel && (
                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${injuryBadgeColor}`}>
                                  {injuryLabel}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px flex-1 bg-[#1a2f1a]" />
            <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Standings</h2>
            <div className="h-px flex-1 bg-[#1a2f1a]" />
          </div>
          <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-0 text-xs bg-[#0d150d] border-b border-[#1a2f1a]">
              <div className="px-4 py-3 font-semibold text-[#5a6b57] text-center w-12">#</div>
              <div className="px-4 py-3 font-semibold text-[#5a6b57]">TEAM</div>
              <div className="px-4 py-3 font-semibold text-[#5a6b57] text-right w-16">PTS</div>
              <div className="px-4 py-3 font-semibold text-[#5a6b57] text-center w-20 hidden sm:block">YESTERDAY</div>
              <div className="px-4 py-3 font-semibold text-[#5a6b57] text-center w-20 hidden md:block">7-DAY</div>
              <div className="px-4 py-3 font-semibold text-[#5a6b57] text-right w-12 hidden sm:block">GB</div>
            </div>
            <div>
              {standings.map((s, idx) => {
                const isExpanded = expandedTeam === s.participantId;
                const maxTrend = Math.max(...s.trend7Day, 1);

                return (
                  <div key={s.participantId}>
                    <div
                      onClick={() => setExpandedTeam(isExpanded ? null : s.participantId)}
                      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-0 text-sm cursor-pointer transition-colors ${
                        s.rank === 1
                          ? 'bg-[#0f1f0f] hover:bg-[#142a14]'
                          : idx % 2 === 0
                            ? 'bg-[#050a05] hover:bg-[#0a0f0a]'
                            : 'bg-[#070c07] hover:bg-[#0a0f0a]'
                      }`}
                    >
                      <div
                        className="px-4 py-3 font-bold text-center w-12"
                        style={s.rank <= 3 ? { color: RANK_COLORS[s.rank - 1] } : undefined}
                      >
                        {s.rank <= 3 ? RANK_MEDALS[s.rank - 1] : s.rank}
                      </div>
                      <div className={`px-4 py-3 font-bold ${s.rank === 1 ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                        {s.teamName}
                      </div>
                      <div className={`px-4 py-3 text-right font-bold w-16 ${s.rank === 1 ? 'text-[#6b9b7a] text-base' : 'text-[#c8d9c3]'}`}>
                        {s.totalPoints.toFixed(1)}
                      </div>
                      <div className="px-4 py-3 text-center w-20 hidden sm:block">
                        {s.yesterdayPoints > 0 ? (
                          <span className="inline-block px-2 py-0.5 bg-[#1a3d1a] text-[#6b9b7a] text-xs font-bold rounded">
                            +{s.yesterdayPoints.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[#2d3c28]">&mdash;</span>
                        )}
                      </div>
                      <div className="px-4 py-3 w-20 hidden md:flex md:items-end md:justify-center">
                        <div className="flex items-end gap-0.5 h-4">
                          {s.trend7Day.map((val, i) => {
                            const height = Math.max((val / maxTrend) * 16, 2);
                            const isLast = i === s.trend7Day.length - 1;
                            return (
                              <div
                                key={i}
                                className={`w-1.5 rounded-sm ${isLast ? 'bg-[#6b9b7a]' : 'bg-[#4a7c59]'}`}
                                style={{ height: `${height}px` }}
                                title={`${val} pts`}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="px-4 py-3 text-right w-12 text-[#5a6b57] hidden sm:block">
                        {s.gamesBehind === 0 ? '-' : s.gamesBehind.toFixed(1)}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="bg-[#030803] border-t border-[#0d150d] border-b border-[#1a2f1a] px-4 py-3">
                        <div className="space-y-1">
                          {s.roster
                            .sort((a, b) => a.round - b.round)
                            .map((p) => {
                              const isOut = p.injuryStatus === "out indefinitely" || p.injuryStatus === "out for playoffs";
                              const isInactive = isOut || p.isEliminated;
                              const injuryLabel =
                                p.injuryStatus === "day-to-day" ? "DTD" :
                                p.injuryStatus === "week-to-week" ? "WTW" :
                                (p.injuryStatus === "out indefinitely" || p.injuryStatus === "out for playoffs") ? "OUT" : null;
                              const injuryBadgeColor =
                                p.injuryStatus === "day-to-day" ? "bg-[#854d0e] text-[#fbbf24]" :
                                p.injuryStatus === "week-to-week" ? "bg-[#9a3412] text-[#fb923c]" :
                                "bg-[#7f1d1d] text-[#fca5a5]";

                              return (
                                <div
                                  key={p.playerId}
                                  className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${isInactive ? "opacity-50" : ""}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#5a6b57] w-5 text-right font-mono text-[10px]">{p.round}</span>
                                    <TeamLogo team={p.team} className="w-4 h-4" />
                                    <span className={`font-medium ${p.isEliminated ? "text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2" : "text-[#c8d9c3]"}`}>
                                      {p.playerName}
                                    </span>
                                    <span className="text-[#5a6b57]">{p.position}</span>
                                    {injuryLabel && (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${injuryBadgeColor}`}>
                                        {injuryLabel}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[#6b9b7a] font-bold">{p.points.toFixed(1)}</span>
                                    <span className="text-[#5a6b57] w-6 text-right">{p.goals}G</span>
                                    <span className="text-[#5a6b57] w-6 text-right">{p.assists}A</span>
                                    <span className="text-[#2d3c28] w-6 text-right">{p.gamesPlayed}GP</span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
