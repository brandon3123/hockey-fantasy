# Post-Draft Results Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a post-draft results page at `/draft/[id]/results` with standings, team rosters, draft awards, and stat visualizations.

**Architecture:** Single page component using `useDraftState` for data. Computed standings/awards/stats derived from picks + players. Recharts for bar and donut charts. No new API endpoints.

**Tech Stack:** React, TypeScript, Next.js, Tailwind CSS, recharts

---

### Task 1: Install recharts

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install recharts**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm install recharts`

- [ ] **Step 2: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "Add recharts dependency for results page charts"
```

---

### Task 2: Create the results page component

**Files:**
- Create: `app/src/app/draft/[id]/results/page.tsx`

This is the main page. It uses `useDraftState` for all data, computes standings/awards/stats inline, and renders all 5 sections.

- [ ] **Step 1: Create the results page**

Create `app/src/app/draft/[id]/results/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useDraftState, DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import { Player } from '@/types/player';
import TeamLogo from '@/components/TeamLogo';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
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

  const mvp = allRostered.reduce((best, cur) =>
    cur.player.displayPoints > best.player.displayPoints ? cur : best
  , allRostered[0]);

  const withAdp = allRostered.filter((r) => r.player.adp != null);
  const lastPick = picks[picks.length - 1];

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

  const mrIrrelevant = lastPick
    ? (() => {
        const player = allRostered.find(
          (r) =>
            `${r.player.name}-${r.player.team}-${r.player.position}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-') === lastPick.player_id
        );
        const participant = participants.find((p) => p.id === lastPick.participant_id);
        return player ? { ...player, pickEntry: lastPick, participant } : null;
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
  const colors: Record<string, string> = { C: '#4a7c59', LW: '#6b9b7a', RW: '#2d5a2d', D: '#1a3d1a' };
  return Object.entries(counts).map(([pos, count]) => ({
    name: pos,
    value: count,
    pct: total > 0 ? Math.round((count / total) * 100) : 0,
    fill: colors[pos] || '#4a7c59',
  }));
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

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

  const {
    draft,
    participants,
    picks,
    players,
    loading,
    isDraftComplete,
    currentUserId,
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
          <Link href="/dashboard" className="text-sm text-[#6b9b7a] hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const maxTeamCount = teamDistribution.length > 0 ? teamDistribution[0].count : 1;

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/dashboard" className="text-sm text-[#5a6b57] hover:text-[#c8d9c3]">&larr; Back to Dashboard</Link>

        {/* Header */}
        <div className="flex justify-between items-start mt-2 mb-8">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#5a6b57] mb-1">Draft Complete</div>
            <h1 className="text-2xl font-bold text-[#c8d9c3]">{draft.name}</h1>
            <div className="text-sm text-[#5a6b57] mt-1">
              {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'} &bull; {participants.length} Managers &bull; {draft.players_per_team} Rounds
            </div>
          </div>
          <div className="bg-[#4a7c59] text-[#c8d9c3] px-4 py-2 rounded-lg font-bold text-sm">
            🏆 FINAL RESULTS
          </div>
        </div>

        {/* Standings */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">Standings</h2>
          <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg overflow-hidden">
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

        {/* Team Rosters */}
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
                      .map((r) => (
                        <div
                          key={`${r.player.name}-${r.player.team}-${r.player.position}`}
                          className="flex justify-between items-center py-2 border-b border-[#141e12] last:border-0"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#5a6b57] w-6">R{r.round}</span>
                            <TeamLogo team={r.player.team} className="w-5 h-5" />
                            <span className="text-[#c8d9c3] font-semibold">{r.player.name}</span>
                            <span className="text-[#5a6b57]">{r.player.position} &bull; {r.player.pointsPerGame.toFixed(2)} ppg</span>
                          </div>
                          <span className="text-[#6b9b7a] font-bold text-xs">{r.player.displayPoints.toFixed(1)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Draft Awards */}
        {awards && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">Draft Awards</h2>
            <div className="grid grid-cols-2 gap-3">
              <AwardCard
                icon="⭐"
                label="MVP"
                color="#ffd700"
                player={awards.mvp.player}
                round={awards.mvp.round}
                participant={awards.mvp.participant}
              />
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

        {/* Draft Stats */}
        {teamDistribution.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[#6b9b7a] uppercase tracking-wider mb-3">Draft Stats</h2>

            {/* Team Distribution */}
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4 mb-3">
              <div className="text-xs font-bold text-[#c8d9c3] mb-3">Players Drafted by NHL Team</div>
              <div className="h-[{teamDistribution.length * 28}px]">
                <ResponsiveContainer width="100%" height={teamDistribution.length * 32}>
                  <BarChart data={teamDistribution} layout="vertical" margin={{ left: 40, right: 20, top: 5, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="team"
                      type="category"
                      tick={{ fill: '#5a6b57', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0a0f0a', border: '1px solid #141e12', borderRadius: '6px', fontSize: 12 }}
                      labelStyle={{ color: '#c8d9c3' }}
                      itemStyle={{ color: '#6b9b7a' }}
                      formatter={(value: number) => [`${value} players`, 'Drafted']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {teamDistribution.map((entry, index) => (
                        <Cell key={index} fill="#4a7c59" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Position Breakdown */}
            {positionBreakdown.length > 0 && (
              <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-4">
                <div className="text-xs font-bold text-[#c8d9c3] mb-3">Position Breakdown</div>
                <div className="flex items-center justify-center">
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
                  <div className="ml-6 text-xs">
                    <div className="text-center mb-2">
                      <div className="text-xl font-bold text-[#c8d9c3]">{totalPicks}</div>
                      <div className="text-[10px] text-[#5a6b57]">total picks</div>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/[id]/results/page.tsx
git commit -m "Add post-draft results page with standings, rosters, awards, and stats"
```

---

### Task 3: Wire up navigation to results page

**Files:**
- Modify: `app/src/app/dashboard/drafts/[id]/page.tsx` — change "View Results" link to point to results page
- Modify: `app/src/app/draft/[id]/coach/page.tsx` — add "Results" button in header when draft complete
- Modify: `app/src/app/draft/[id]/team/page.tsx` — add "Results" button in header when draft complete

- [ ] **Step 1: Update dashboard "View Results" link**

In `app/src/app/dashboard/drafts/[id]/page.tsx`, find the `{draft.status === 'complete' && (` block (around line 199). Change the `href` from `/draft/${draftId}/live` to `/draft/${draftId}/results`.

- [ ] **Step 2: Add Results button on coach page header**

In `app/src/app/draft/[id]/coach/page.tsx`, find where the "Round X, Pick Y" and "Draft Complete" status text is shown (around line 146-153). After the "Draft Complete" text, add a Link to the results page:

```tsx
{isDraftComplete && (
  <>
    <div className="text-sm text-[#6b9b7a] mt-1">Draft Complete</div>
    <Link
      href={`/draft/${draftId}/results`}
      className="mt-2 inline-block px-4 py-1.5 text-xs font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
    >
      View Results
    </Link>
  </>
)}
```

Replace the existing `{isDraftComplete && (<div className="text-sm text-[#6b9b7a] mt-1">Draft Complete</div>)}` with the above.

- [ ] **Step 3: Add Results button on team page header**

In `app/src/app/draft/[id]/team/page.tsx`, find the similar "Draft Complete" display. Add the same results link pattern.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Verify build**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx next build`
Expected: Successful build

- [ ] **Step 6: Commit**

```bash
git add app/src/app/dashboard/drafts/[id]/page.tsx app/src/app/draft/[id]/coach/page.tsx app/src/app/draft/[id]/team/page.tsx
git commit -m "Wire up navigation to post-draft results page"
```
