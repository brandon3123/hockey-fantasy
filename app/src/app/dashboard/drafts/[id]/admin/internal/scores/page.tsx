'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import TeamLogo from '@/components/TeamLogo';
import InjuryBadge from '@/components/InjuryBadge';

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
  injuryStatus: string;
  injuryDescription: string | null;
  isEliminated: boolean;
}

interface StandingEntry {
  participantId: string;
  teamName: string;
  rank: number;
  totalPoints: number;
  yesterdayPoints: number;
  gamesBehind: number;
  roster: RosterPlayer[];
}

interface ScorerDetail {
  playerName: string;
  nhlTeam: string;
  goals: number;
  assists: number;
  points: number;
  fantasyTeam: string;
}

interface TeamPointsDetail {
  teamName: string;
  points: number;
}

interface CronRun {
  id: string;
  run_date: string;
  games_found: number;
  results_found: number;
  scores_upserted: number;
  emails_sent: number;
  errors: string[];
  score_details: { scorers: ScorerDetail[]; teamPoints: TeamPointsDetail[] } | null;
  ran_at: string;
}

interface DraftInfo {
  id: string;
  name: string;
  season_type: string;
  players_per_team: number;
  scoring_format: string;
}

const TABS = ['scores', 'cron-log', 'backfill'] as const;
type Tab = typeof TABS[number];

const RANK_MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

interface RunCardProps {
  date: string;
  gamesFound: number;
  resultsFound: number;
  scoresUpserted: number;
  emailsSent?: number;
  errors: string[];
  scorers: ScorerDetail[];
  teamPoints: TeamPointsDetail[];
  ranAt?: string;
  borderClassName?: string;
}

function RunCard({ date, gamesFound, resultsFound, scoresUpserted, emailsSent, errors, scorers, teamPoints, ranAt, borderClassName }: RunCardProps) {
  const realErrors = (errors || []).filter((e) => !e.startsWith('Unmatched:'));
  const hasRealErrors = realErrors.length > 0;
  const unmatched = (errors || []).filter((e) => e.startsWith('Unmatched:')).flatMap((e) => e.replace('Unmatched: ', '').split(', '));
  const dotColor = hasRealErrors ? 'bg-[#f87171]' : unmatched.length > 0 ? 'bg-[#9b8f6b]' : 'bg-[#4a7c59]';
  const runTime = ranAt
    ? new Date(ranAt).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : null;
  const border = borderClassName ?? (hasRealErrors ? 'border-[#3d1a1a]' : 'border-[#141e12]');

  return (
    <div className={`bg-[#0a0f0a] border ${border} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="font-mono text-sm text-[#c8d9c3]">{date}</span>
        </div>
        {runTime && <span className="text-sm text-[#5a6b57]">{runTime}</span>}
      </div>
      <div className={`grid ${emailsSent !== undefined ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-center`}>
        <div><div className="text-[10px] text-[#5a6b57] uppercase">Games</div><div className="text-sm font-semibold text-[#c8d9c3] mt-0.5">{gamesFound}</div></div>
        <div><div className="text-[10px] text-[#5a6b57] uppercase">Results</div><div className="text-sm font-semibold text-[#c8d9c3] mt-0.5">{resultsFound}</div></div>
        <div><div className="text-[10px] text-[#5a6b57] uppercase">Scores</div><div className="text-sm font-semibold text-[#6b9b7a] mt-0.5">{scoresUpserted}</div></div>
        {emailsSent !== undefined && (
          <div><div className="text-[10px] text-[#5a6b57] uppercase">Emails</div><div className="text-sm font-semibold text-[#c8d9c3] mt-0.5">{emailsSent}</div></div>
        )}
      </div>
      {teamPoints.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1a2f1a]">
          <div className="text-[10px] text-[#5a6b57] uppercase font-bold mb-2">Team Points</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {teamPoints.map((t) => (
              <div key={t.teamName} className="flex items-center gap-2 text-sm">
                <span className="text-[#c8d9c3] font-medium">{t.teamName}</span>
                <span className="text-[#6b9b7a] font-bold">+{t.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {scorers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1a2f1a]">
          <div className="text-[10px] text-[#5a6b57] uppercase font-bold mb-2">Scorers</div>
          <div className="space-y-1">
            {[...scorers].sort((a, b) => b.points - a.points).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TeamLogo team={s.nhlTeam} className="w-4 h-4" />
                  <span className="text-[#c8d9c3] font-medium">{s.playerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#5a6b57]">{s.goals}G</span>
                  <span className="text-[#5a6b57]">{s.assists}A</span>
                  <span className="text-[#6b9b7a] font-bold">{s.points}pts</span>
                  <span className="text-[10px] text-[#9b8f6b] bg-[#1a1a0f] px-1.5 py-0.5 rounded">{s.fantasyTeam}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {unmatched.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#141e12]">
          <div className="text-xs text-[#9b8f6b]">{unmatched.length} undrafted player{unmatched.length !== 1 ? 's' : ''} scored</div>
          <div className="text-[10px] text-[#5a6b57] mt-1">{unmatched.join(', ')}</div>
        </div>
      )}
      {hasRealErrors && (
        <div className="mt-3 pt-3 border-t border-[#3d1a1a]">
          {realErrors.map((err, i) => (
            <div key={i} className="text-sm text-[#f87171]">{err}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScoresPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const draftId = params.id as string;

  const { isAdmin } = useIsAdmin();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('scores');
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editGoals, setEditGoals] = useState(0);
  const [editAssists, setEditAssists] = useState(0);
  const [saving, setSaving] = useState(false);

  const [cronRuns, setCronRuns] = useState<CronRun[]>([]);

  const [backfillDates, setBackfillDates] = useState<{ date: string; day: string; status: string; scores: number }[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);

  useEffect(() => {
    if (!user) { setAuthChecked(true); return; }
    if (!isAdmin) {
      router.replace('/');
    }
    setAuthChecked(true);
  }, [user, isAdmin, router]);

  const fetchStandings = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/drafts/${draftId}/standings`);
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
      setStandings(data.standings || []);
    }
    setLoading(false);
  }, [draftId]);

  const fetchCronRuns = useCallback(async () => {
    const res = await fetch(`/api/drafts/${draftId}/cron-runs`);
    if (res.ok) {
      const data = await res.json();
      setCronRuns(data.runs || []);
    }
  }, [draftId]);

  const buildBackfillDates = useCallback(async () => {
    const runsRes = await fetch(`/api/drafts/${draftId}/cron-runs`);
    const runsData = runsRes.ok ? await runsRes.json() : { runs: [] };
    const runs: CronRun[] = (runsData.runs || []);
    const runMap = new Map<string, CronRun>(runs.map((r) => [r.run_date, r]));

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dates: { date: string; day: string; status: string; scores: number }[] = [];
    const now = new Date();
    for (let i = 1; i <= 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const day = days[d.getDay()];
      const run = runMap.get(dateStr);
      if (run) {
        const hasErrors = run.errors && run.errors.length > 0;
        const hasRealErrors = hasErrors && run.errors.some((e: string) => !e.startsWith('Unmatched:'));
        const status = hasRealErrors
          ? `${run.scores_upserted} scores \u00B7 error`
          : `${run.scores_upserted} scores`;
        dates.push({ date: dateStr, day, status, scores: run.scores_upserted });
      } else {
        dates.push({ date: dateStr, day, status: 'No run recorded', scores: 0 });
      }
    }
    setBackfillDates(dates);
  }, [draftId]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    fetchStandings();
  }, [user, isAdmin, fetchStandings]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    if (tab === 'cron-log') fetchCronRuns();
    if (tab === 'backfill') buildBackfillDates();
  }, [user, isAdmin, tab, fetchCronRuns, buildBackfillDates]);

  const handleSave = async (playerId: string) => {
    setSaving(true);
    await fetch(`/api/drafts/${draftId}/scores`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, goals: editGoals, assists: editAssists }),
    });
    setEditingPlayer(null);
    setSaving(false);
    fetchStandings();
  };

  const handleBackfill = async () => {
    const dates = Array.from(selectedDates).sort();
    if (dates.length === 0) return;
    setBackfilling(true);
    setBackfillResult(null);
    const res = await fetch(`/api/drafts/${draftId}/backfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dates }),
    });
    if (res.ok) setBackfillResult(await res.json());
    setBackfilling(false);
    buildBackfillDates();
  };

  const toggleDate = (date: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  if (!authChecked || (!isAdmin && authChecked)) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57]">{loading ? 'Loading...' : 'Draft not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-[#5a6b57] mb-1">Admin</div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3]">{draft.name}</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-[#5a6b57] mt-1">
            <span>{draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{standings.length} Managers</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{draft.players_per_team} Rounds</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 mb-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t ? 'bg-[#4a7c59] text-[#c8d9c3]' : 'text-[#5a6b57] hover:text-[#c8d9c3]'
              }`}
            >
              {t === 'cron-log' ? 'Cron Log' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'scores' && (
          <div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Team Scores</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-0 text-xs bg-[#0d150d] border-b border-[#1a2f1a]">
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-center w-12">#</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57]">TEAM</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-right w-16">PTS</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-center w-20 hidden sm:block">YESTERDAY</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-right w-12 hidden sm:block">GB</div>
                <div className="px-4 py-3 w-8" />
              </div>
              <div>
                {standings.map((s, idx) => {
                  const isExpanded = expandedTeam === s.participantId;
                  return (
                    <div key={s.participantId}>
                      <div
                        onClick={() => setExpandedTeam(isExpanded ? null : s.participantId)}
                        className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-0 text-sm cursor-pointer transition-colors ${
                          s.rank === 1 ? 'bg-[#0f1f0f] hover:bg-[#142a14]'
                          : idx % 2 === 0 ? 'bg-[#050a05] hover:bg-[#0a0f0a]'
                          : 'bg-[#070c07] hover:bg-[#0a0f0a]'
                        }`}
                      >
                        <div className="px-4 py-3 font-bold text-center w-12" style={s.rank <= 3 ? { color: RANK_COLORS[s.rank - 1] } : undefined}>
                          {s.rank <= 3 ? RANK_MEDALS[s.rank - 1] : s.rank}
                        </div>
                        <div className={`px-4 py-3 font-bold ${s.rank === 1 ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                          {s.teamName}
                        </div>
                        <div className={`px-4 py-3 text-right font-bold w-16 ${s.rank === 1 ? 'text-[#6b9b7a] text-base' : 'text-[#c8d9c3]'}`}>
                          {s.totalPoints}
                        </div>
                        <div className="px-4 py-3 text-center w-20 hidden sm:block">
                          {s.yesterdayPoints > 0 ? (
                            <span className="inline-block px-2 py-0.5 bg-[#1a3d1a] text-[#6b9b7a] text-xs font-bold rounded">+{s.yesterdayPoints}</span>
                          ) : (
                            <span className="text-[#2d3c28]">&mdash;</span>
                          )}
                        </div>
                        <div className="px-4 py-3 text-right w-12 text-[#5a6b57] hidden sm:block">
                          {s.gamesBehind === 0 ? '-' : s.gamesBehind}
                        </div>
                        <div className="px-2 py-3 w-8" />
                      </div>
                      {isExpanded && (
                        <div className="bg-[#030803] border-t border-[#0d150d] border-b border-[#1a2f1a] px-4 py-3">
                          <div className="space-y-1">
                            {s.roster.sort((a, b) => a.round - b.round).map((p) => {
                              const isOut = p.injuryStatus === 'out indefinitely' || p.injuryStatus === 'out for playoffs';
                              const isInactive = isOut || p.isEliminated;
                              const isEditing = editingPlayer === p.playerId;
                              return (
                                <div key={p.playerId} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${isInactive ? 'opacity-50' : ''} ${isEditing ? 'bg-[#0a0f0a] border border-[#4a7c59]' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#5a6b57] w-5 text-right font-mono text-[10px]">{p.round}</span>
                                    <TeamLogo team={p.team} className="w-4 h-4" />
                                    <span className={`font-medium ${p.isEliminated ? 'text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2' : 'text-[#c8d9c3]'}`}>
                                      {p.playerName}
                                    </span>
                                    <span className="text-[#5a6b57]">{p.position}</span>
                                    {p.injuryStatus && p.injuryStatus !== 'healthy' && (
                                      <InjuryBadge status={p.injuryStatus} description={p.injuryDescription} size="xs" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {isEditing ? (
                                      <>
                                        <div className="flex items-center gap-1">
                                          <input type="number" min={0} value={editGoals} onChange={e => setEditGoals(parseInt(e.target.value) || 0)} className="w-12 px-2 py-1 text-center text-sm bg-[#050a05] border border-[#4a7c59] rounded text-[#c8d9c3] focus:outline-none" />
                                          <span className="text-[#5a6b57] text-xs">G</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <input type="number" min={0} value={editAssists} onChange={e => setEditAssists(parseInt(e.target.value) || 0)} className="w-12 px-2 py-1 text-center text-sm bg-[#050a05] border border-[#4a7c59] rounded text-[#c8d9c3] focus:outline-none" />
                                          <span className="text-[#5a6b57] text-xs">A</span>
                                        </div>
                                        <span className="text-[#6b9b7a] font-bold w-10 text-center text-sm">{draft.scoring_format === '2pt_goals_1pt_assists' ? editGoals * 2 + editAssists : editGoals + editAssists}</span>
                                        <div className="flex gap-1.5">
                                          <button onClick={() => handleSave(p.playerId)} disabled={saving} className="text-[#6b9b7a] hover:text-[#c8d9c3] disabled:opacity-50 text-base p-1">{'\u2713'}</button>
                                          <button onClick={() => setEditingPlayer(null)} className="text-[#f87171] hover:text-red-300 text-base p-1">{'\u2715'}</button>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[#5a6b57] text-right w-7">{p.goals}G</span>
                                        <span className="text-[#5a6b57] text-right w-7">{p.assists}A</span>
                                        <span className="text-[#6b9b7a] font-bold">{p.points}</span>
                                        <button onClick={() => { setEditingPlayer(p.playerId); setEditGoals(p.goals); setEditAssists(p.assists); }} className="text-[#6b9b7a] hover:text-[#c8d9c3] text-base p-1">{'\u270E'}</button>
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
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'cron-log' && (
          <div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Recent Runs</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            {cronRuns.length === 0 ? (
              <div className="text-sm text-[#5a6b57] text-center py-8">No cron runs recorded</div>
            ) : (
              <div className="space-y-3">
                {cronRuns.map(run => (
                  <RunCard
                    key={run.id}
                    date={run.run_date}
                    gamesFound={run.games_found}
                    resultsFound={run.results_found}
                    scoresUpserted={run.scores_upserted}
                    emailsSent={run.emails_sent}
                    errors={run.errors}
                    scorers={run.score_details?.scorers ?? []}
                    teamPoints={run.score_details?.teamPoints ?? []}
                    ranAt={run.ran_at}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-4 mt-4 text-xs text-[#5a6b57]">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#4a7c59]" /> Healthy</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#9b8f6b]" /> Undrafted</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#f87171]" /> Errors</div>
            </div>
          </div>
        )}

        {tab === 'backfill' && (
          <div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Select Dates to Re-Run</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            <div className="text-sm text-[#5a6b57] mb-3">Check dates to re-score. Dates with no run may have been missed.</div>
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl overflow-hidden">
              {backfillDates.map((d, i) => {
                const isSelected = selectedDates.has(d.date);
                const isError = d.status.includes('error');
                const isNoRun = d.status === 'No run recorded';
                return (
                  <div key={d.date} onClick={() => toggleDate(d.date)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#0a0f0a] transition-colors ${i % 2 === 0 ? 'bg-[#050a05]' : 'bg-[#070c07]'}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="accent-[#4a7c59] w-3.5 h-3.5 cursor-pointer" />
                    <span className="font-mono text-sm text-[#c8d9c3]">{d.date}</span>
                    <span className={`text-xs ${isError || isNoRun ? 'text-[#f87171]' : 'text-[#6b9b7a]'}`}>{d.status}</span>
                    <span className="ml-auto text-xs text-[#5a6b57]">{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-[#5a6b57]">{selectedDates.size} date{selectedDates.size !== 1 ? 's' : ''} selected</span>
              <button onClick={handleBackfill} disabled={backfilling || selectedDates.size === 0} className="px-5 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors disabled:opacity-50">
                {backfilling ? 'Running...' : 'Run Backfill'}
              </button>
            </div>
            {backfillResult && (
              <div className="mt-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-[#1a2f1a]" />
                  <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Results</h2>
                  <div className="h-px flex-1 bg-[#1a2f1a]" />
                </div>
                <div className="space-y-3">
                  {backfillResult.results?.map((r: any, i: number) => (
                    <RunCard
                      key={i}
                      date={r.date}
                      gamesFound={r.games}
                      resultsFound={r.results ?? 0}
                      scoresUpserted={r.upserted}
                      errors={r.errors}
                      scorers={r.scorers ?? []}
                      teamPoints={r.teamPoints ?? []}
                      borderClassName="border-[#141e12]"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
