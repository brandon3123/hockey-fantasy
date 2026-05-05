'use client';

import { useAuth } from '@/context/auth-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';
import DraftStartModal from '@/components/DraftStartModal';

interface DashboardData {
  draft: { id: string; name: string; status: string; seasonType: string; scoringFormat: string } | null;
  isAdmin: boolean;
  rank: number | null;
  totalTeams: number | null;
  totalPoints: number | null;
  yesterdayPoints: number | null;
  roster: Array<{
    playerId: string; playerName: string; team: string; position: string;
    totalPoints: number; yesterdayPoints: number;
    injuryStatus: string; injuryDescription: string | null; isEliminated: boolean;
  }>;
  standings: Array<{ participantId: string; teamName: string; totalPoints: number; isYou: boolean }>;
  tonightGames: Array<{ away: string; home: string; awayLogo: string; homeLogo: string; time: string }>;
  activePlayerCount: number;
  eliminatedTeams: string[];
  totalPlayoffTeams: number;
}

interface Draft {
  id: string; name: string; season_type: string; status: string;
  draft_date: string | null; draft_time: string | null; created_at: string;
  location?: string; entry_fee?: number; currency?: string;
  payment_method?: string; payment_info?: string; notes?: string;
  players_per_team?: number; scoring_format?: string;
  joined_count?: number; pending_count?: number; paid_count?: number;
}

interface JoinedDraft extends Draft { team_name: string; has_paid: boolean; }

function getOrdinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'setup') return <span className="text-sm font-semibold text-[#5a6b57]">Setup</span>;
  if (status === 'inviting') return <span className="text-sm font-semibold bg-[#9b8f6b] text-[#0a0f0a] px-2 py-0.5 rounded">Inviting</span>;
  if (status === 'in_progress') return <span className="text-sm font-semibold bg-[#4a7c59] text-[#c8d9c3] px-2 py-0.5 rounded">In Progress</span>;
  if (status === 'complete') return <span className="text-sm font-semibold text-[#5a6b57]">Complete</span>;
  return <span className="text-sm font-semibold text-[#5a6b57]">{status}</span>;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [joined, setJoined] = useState<JoinedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [startingDraftId, setStartingDraftId] = useState<string | null>(null);
  const [startParticipants, setStartParticipants] = useState<Array<{ id: string; team_name: string; draft_position: number | null }>>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        if (!data.draft || data.draft.status !== 'complete') {
          const draftRes = await fetch('/api/drafts');
          if (draftRes.ok) {
            const draftData = await draftRes.json();
            setDrafts(draftData.drafts || []);
            setJoined(draftData.joined || []);
          }
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDashboard();
  }, [user, fetchDashboard]);

  const handleDeleteDraft = async (e: React.MouseEvent, draftId: string, draftName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${draftName}"? This removes all invites, participants, and picks. This cannot be undone.`)) return;
    setDeleting(draftId);
    const res = await fetch('/api/drafts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: draftId }),
    });
    if (res.ok) {
      fetchDashboard();
    }
    setDeleting(null);
  };

  const handleStartDraft = async (draftId: string) => {
    const res = await fetch(`/api/drafts/${draftId}`);
    if (res.ok) {
      const data = await res.json();
      const parts = (data.participants || []).map((p: any) => ({
        id: p.id,
        team_name: p.team_name,
        draft_position: p.draft_position,
      }));
      if (parts.length === 0) {
        alert('No participants yet. Invite people first.');
        return;
      }
      setStartParticipants(parts);
      setStartingDraftId(draftId);
    }
  };

  const formatDate = (d: Draft) => {
    const parts = [];
    if (d.draft_date) parts.push(new Date(d.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    if (d.draft_time) parts.push(`at ${d.draft_time}`);
    if (d.draft_date) parts.push('\u2022');
    parts.push(d.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season');
    return parts.join(' ');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo/logo-hero.svg" alt="Top Shelf Draft" className="w-64" />
          </div>
          <p className="text-[#5a6b57] mb-8 max-w-md mx-auto">
            Data-driven NHL fantasy draft assistant. Research players, run your draft, track standings.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/login"
              className="px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="px-6 py-3 border border-[#4a7c59] text-[#6b9b7a] rounded-lg font-semibold hover:bg-[#0a0f0a] transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  if (dashboard?.draft && dashboard.draft.status === 'complete') {
    const { draft, isAdmin, rank, totalTeams, totalPoints, yesterdayPoints, roster, standings, tonightGames, activePlayerCount, eliminatedTeams, totalPlayoffTeams } = dashboard;

    const hasRosterAlerts = roster.some(p => p.injuryStatus !== 'healthy' || p.isEliminated);
    const injuredPlayers = roster.filter(p => p.injuryStatus !== 'healthy' || p.isEliminated);

    return (
      <div className="min-h-screen bg-[#050a05]">
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-[#0a0f0a] border border-[#4a7c59] rounded-lg p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#6b9b7a] mb-1">Active Draft</div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3]">{draft.name}</h1>
              <div className="text-sm text-[#5a6b57] mt-1">
                {draft.seasonType === 'playoffs' ? 'Playoffs' : 'Regular Season'} &middot; {draft.scoringFormat || 'Standard'}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {rank !== null && totalTeams !== null && (
                <div className="text-right">
                  <div className="text-3xl md:text-4xl font-bold text-[#6b9b7a]">{getOrdinal(rank)}</div>
                  <div className="text-sm text-[#5a6b57]">of {totalTeams} teams</div>
                </div>
              )}
              {isAdmin && (
                <>
                  <Link
                    href={`/dashboard/drafts/${draft.id}/admin/internal/scores`}
                    className="px-3 py-1.5 text-xs font-medium border border-[#9b8f6b] text-[#9b8f6b] rounded-lg hover:bg-[#0a0f0a] transition-colors"
                  >
                    Manage Scores
                  </Link>
                  <button
                    onClick={(e) => handleDeleteDraft(e, draft.id, draft.name)}
                    disabled={deleting === draft.id}
                    className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm disabled:opacity-50 p-2"
                    title="Delete draft"
                  >
                    {deleting === draft.id ? '...' : '\u2715'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 border-b border-[#1a2f1a] pb-3">
              <span className="text-sm font-bold text-[#c8d9c3]">My Team</span>
              <div className="text-sm text-[#5a6b57]">
                {totalPoints !== null && <span className="text-[#c8d9c3]">{totalPoints} pts total</span>}
                {yesterdayPoints !== null && yesterdayPoints > 0 && (
                  <span className="ml-2 text-[#6b9b7a]">+{yesterdayPoints} yesterday</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {roster.map(player => {
                const isOut = player.injuryStatus.toLowerCase().includes('out') && player.injuryStatus !== 'day-to-day';
                const isDTD = player.injuryStatus === 'day-to-day';
                return (
                  <div
                    key={player.playerId}
                    className={`bg-[#0d150d] border border-[#1a2f1a] rounded-lg p-2 text-center ${isOut ? 'opacity-60' : ''}`}
                  >
                    <div className="flex justify-center mb-1">
                      <TeamLogo team={player.team} className="w-6 h-6" />
                    </div>
                    <div className={`text-sm font-medium ${player.isEliminated ? 'text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2' : 'text-[#c8d9c3]'}`}>{player.playerName}</div>
                    <div className={`text-xs ${player.isEliminated ? 'text-[#fca5a5]' : 'text-[#5a6b57]'}`}>{player.position} &middot; {player.team}</div>
                    <div className="text-xs mt-1">
                      {player.yesterdayPoints > 0 ? (
                        <span className="text-[#6b9b7a]">+{player.yesterdayPoints} pts</span>
                      ) : (
                        <span className="text-[#5a6b57]">&mdash;</span>
                      )}
                    </div>
                    {isDTD && <div className="text-[10px] font-bold text-[#ff9f0a] mt-1">DAY-TO-DAY</div>}
                    {isOut && !player.isEliminated && <div className="text-[10px] font-bold text-[#ff3b30] mt-1">OUT</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 border-b border-[#1a2f1a] pb-3">
                <span className="text-sm font-bold text-[#c8d9c3]">Standings</span>
                <Link
                  href={`/draft/${draft.id}/standings`}
                  className="px-3 py-1.5 text-xs font-medium bg-[#4a7c59] text-[#c8d9c3] rounded hover:bg-[#3d664a] transition-colors"
                >
                  View Full Standings
                </Link>
              </div>
              <div className="space-y-1">
                {standings.map((team, i) => (
                  <div
                    key={team.participantId}
                    className={`flex items-center justify-between py-1.5 px-2 rounded ${team.isYou ? 'bg-[rgba(74,124,89,0.15)]' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm w-6 ${team.isYou ? 'text-[#6b9b7a] font-bold' : 'text-[#5a6b57]'}`}>{i + 1}.</span>
                      <span className={`text-sm ${team.isYou ? 'text-[#6b9b7a] font-bold' : 'text-[#c8d9c3]'}`}>{team.teamName}</span>
                    </div>
                    <span className={`text-sm ${team.isYou ? 'text-[#6b9b7a] font-bold' : 'text-[#5a6b57]'}`}>{team.totalPoints} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 border-b border-[#1a2f1a] pb-3">
                <span className="text-sm font-bold text-[#c8d9c3]">Tonight&apos;s Games</span>
                <Link
                  href="/games"
                  className="px-3 py-1.5 text-xs font-medium bg-[#4a7c59] text-[#c8d9c3] rounded hover:bg-[#3d664a] transition-colors"
                >
                  View All Games
                </Link>
              </div>
              {tonightGames.length === 0 ? (
                <div className="text-sm text-[#5a6b57]">No games scheduled</div>
              ) : (
                <div className="space-y-2">
                  {tonightGames.map((game, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={game.away} className="w-6 h-6" />
                        <span className="text-sm text-[#c8d9c3]">{game.away}</span>
                      </div>
                      <span className="text-xs text-[#5a6b57]">@</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#c8d9c3]">{game.home}</span>
                        <TeamLogo team={game.home} className="w-6 h-6" />
                      </div>
                      <span className="text-xs text-[#5a6b57] ml-2">{game.time}</span>
                    </div>
                  ))}
                </div>
              )}
              {activePlayerCount > 0 && (
                <div className="text-xs text-[#5a6b57] mt-3">{activePlayerCount} of your players in action</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hasRosterAlerts && (
              <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 border-b border-[#1a2f1a] pb-3">
                  <span className="text-sm font-bold text-[#c8d9c3]">Roster Alerts</span>
                </div>
                <div className="space-y-2">
                  {injuredPlayers.map(player => {
                    const isOut = player.injuryStatus.toLowerCase().includes('out') && player.injuryStatus !== 'day-to-day';
                    const isDTD = player.injuryStatus === 'day-to-day';
                    return (
                      <div key={player.playerId} className="flex items-center gap-3 py-1.5">
                         {isOut && !player.isEliminated && <span className="text-[10px] font-bold text-[#c8d9c3] bg-[#ff3b30] px-1.5 py-0.5 rounded">OUT</span>}
                         {isDTD && !player.isEliminated && <span className="text-[10px] font-bold text-[#0a0f0a] bg-[#ff9f0a] px-1.5 py-0.5 rounded">DTD</span>}
                         <TeamLogo team={player.team} className="w-5 h-5" />
                         <span className={`text-sm flex-1 ${player.isEliminated ? 'text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2' : 'text-[#c8d9c3]'}`}>{player.playerName}</span>
                         <span className="text-xs text-[#5a6b57]">
                           {player.isEliminated ? 'Eliminated' : player.injuryDescription || ''}
                         </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {eliminatedTeams.length > 0 && (
              <div className={`bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4 md:p-6 ${hasRosterAlerts ? '' : 'md:col-span-2'}`}>
                <div className="mb-4 border-b border-[#1a2f1a] pb-3">
                  <span className="text-sm font-bold text-[#c8d9c3]">Teams Eliminated</span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {eliminatedTeams.map(abbrev => (
                    <div key={abbrev} className="flex flex-col items-center">
                      <TeamLogo team={abbrev} className="w-8 h-8" />
                      <span className="text-xs text-[#ff3b30] line-through mt-1">{abbrev}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-[#5a6b57] mt-3">{eliminatedTeams.length} of {totalPlayoffTeams} playoff teams eliminated</div>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  const allEmpty = drafts.length === 0 && joined.length === 0;

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-2">
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3]">My Drafts</h1>
          <Link
            href="/dashboard/drafts/new"
            className="px-4 py-2.5 md:px-6 md:py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Create New Draft
          </Link>
        </div>

        {allEmpty ? (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4">
              <img src="/logo/logo-hero.svg" alt="Top Shelf Draft" className="w-48" />
            </div>
            <h2 className="text-xl font-bold text-[#c8d9c3] mb-2">No drafts yet</h2>
            <p className="text-[#5a6b57] mb-6">Create your first draft or join one with an invite link</p>
            <Link
              href="/dashboard/drafts/new"
              className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
            >
              Create New Draft
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {drafts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#6b9b7a] mb-3">Admin</h2>
                <div className="grid gap-4">
                  {drafts.map((draft) => {
                    const isInProgress = draft.status === 'in_progress';
                    return (
                      <div
                        key={draft.id}
                        className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-6"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-bold text-[#c8d9c3]">{draft.name}</h3>
                              <StatusBadge status={draft.status} />
                            </div>
                            <div className="text-sm text-[#5a6b57] mt-1">
                              {formatDate(draft)}
                              {draft.players_per_team && ` \u2022 ${draft.players_per_team} players/team`}
                            </div>
                            {(draft.status === 'setup' || draft.status === 'inviting') && (
                              <div className="mt-3">
                                <div className="grid grid-cols-4 gap-2 text-center">
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Joined</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.joined_count ?? 0}</div>
                                  </div>
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Pending</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.pending_count ?? 0}</div>
                                  </div>
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Paid</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.paid_count ?? 0}/{draft.joined_count ?? 0}</div>
                                  </div>
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Fee</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.entry_fee ? `${draft.currency || '$'}${draft.entry_fee}` : 'Free'}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {isInProgress && (
                              <div className="mt-3">
                                <div className="grid grid-cols-4 gap-2 text-center">
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Teams</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.joined_count ?? 0}</div>
                                  </div>
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Rounds</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.players_per_team || '?'}</div>
                                  </div>
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Paid</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.paid_count ?? 0}/{draft.joined_count ?? 0}</div>
                                  </div>
                                  <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                                    <div className="text-[10px] text-[#5a6b57] uppercase">Fee</div>
                                    <div className="text-sm font-semibold text-[#c8d9c3]">{draft.entry_fee ? `${draft.currency || '$'}${draft.entry_fee}` : 'Free'}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.preventDefault(); handleDeleteDraft(e, draft.id, draft.name); }}
                            disabled={deleting === draft.id}
                            className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm disabled:opacity-50 p-2"
                            title="Delete draft"
                          >
                            {deleting === draft.id ? '...' : '\u2715'}
                          </button>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          {!isInProgress && (
                            <button
                              onClick={() => handleStartDraft(draft.id)}
                              className="px-4 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors"
                            >
                              Start Draft
                            </button>
                          )}
                          <Link
                            href={`/dashboard/drafts/${draft.id}`}
                            className="px-4 py-2 text-sm font-medium border border-[#4a7c59] text-[#6b9b7a] rounded-lg hover:bg-[#0a0f0a] transition-colors"
                          >
                            Configure
                          </Link>
                          {isInProgress && (
                            <>
                              <Link
                                href={`/draft/${draft.id}/coach`}
                                className="px-4 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors"
                              >
                                My Team
                              </Link>
                              <Link
                                href={`/draft/${draft.id}/live`}
                                className="px-4 py-2 text-sm font-medium border border-[#4a7c59] text-[#6b9b7a] rounded-lg hover:bg-[#0a0f0a] transition-colors"
                              >
                                Draft Board
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {joined.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#9b8f6b] mb-3">Joined</h2>
                <div className="grid gap-4">
                  {joined.map((draft) => {
                    const isInProgress = draft.status === 'in_progress';
                    return (
                      <div
                        key={draft.id}
                        className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-6"
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-[#c8d9c3]">{draft.name}</h3>
                          <StatusBadge status={draft.status} />
                        </div>
                        <div className="text-sm text-[#5a6b57] mt-1">
                          {formatDate(draft)}
                        </div>
                        {draft.team_name && (
                          <div className="mt-3 bg-[#0d150d] border border-[#4a7c59] rounded-lg p-3">
                            <div className="text-sm font-medium text-[#c8d9c3]">{draft.team_name}</div>
                            {draft.has_paid ? (
                              <span className="text-xs text-[#6b9b7a]">&#10003; Paid</span>
                            ) : (
                              <span className="text-xs text-[#9b8f6b]">Not paid</span>
                            )}
                          </div>
                        )}
                        <div className="mt-3">
                          <div className="grid grid-cols-3 gap-2 text-center">
                             <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                               <div className="text-[10px] text-[#5a6b57] uppercase">Joined</div>
                               <div className="text-sm font-semibold text-[#c8d9c3]">{draft.joined_count ?? 0}</div>
                             </div>
                             <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                               <div className="text-[10px] text-[#5a6b57] uppercase">Players</div>
                               <div className="text-sm font-semibold text-[#c8d9c3]">{draft.players_per_team || 'N/A'}</div>
                             </div>
                             <div className="bg-[#0d150d] border border-[#1a2f1a] rounded px-2 py-1.5">
                               <div className="text-[10px] text-[#5a6b57] uppercase">Fee</div>
                               <div className="text-sm font-semibold text-[#c8d9c3]">{draft.entry_fee ? `${draft.currency || '$'}${draft.entry_fee}` : 'Free'}</div>
                             </div>
                          </div>
                        </div>
                        {(draft.location || draft.payment_info) && (
                          <div className="mt-2 text-xs text-[#5a6b57]">
                            {draft.location && <span>{draft.location}</span>}
                            {draft.location && draft.payment_info && <span> &middot; </span>}
                            {draft.payment_info && <span>{draft.payment_info}</span>}
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-3">
                          {(draft.status === 'setup' || draft.status === 'inviting') && (
                            <div className="text-sm text-[#5a6b57]">
                              &#9203; Waiting for admin to start the draft
                            </div>
                          )}
                          {isInProgress && (
                            <>
                              <Link
                                href={`/draft/${draft.id}/team`}
                                className="px-4 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors"
                              >
                                My Team
                              </Link>
                              <Link
                                href={`/draft/${draft.id}/live`}
                                className="px-4 py-2 text-sm font-medium border border-[#4a7c59] text-[#6b9b7a] rounded-lg hover:bg-[#0a0f0a] transition-colors"
                              >
                                Draft Board
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {startingDraftId && (
        <DraftStartModal
          draftId={startingDraftId}
          participants={startParticipants}
          adminTeamName="Commissioner"
          onStart={() => {
            setStartingDraftId(null);
            router.push(`/draft/${startingDraftId}/live`);
          }}
          onClose={() => setStartingDraftId(null)}
        />
      )}
    </div>
  );
}
