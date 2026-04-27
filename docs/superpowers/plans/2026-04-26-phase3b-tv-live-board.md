# Phase 3b: TV Live Draft Board — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TV/laptop live draft board page that the admin uses to run the draft — draft grid with row highlighting, player sidebar for making picks, ON THE CLOCK banner with optional timer.

**Architecture:** New page at `/draft/[id]/live` using the `useDraftState` hook from Phase 3a. Reuses the existing DraftGrid component adapted for multi-user Supabase-backed data. New `LivePlayerSidebar` component for picking players. Admin-only access.

**Tech Stack:** Next.js 15 App Router, Supabase Realtime (via useDraftState hook), TypeScript, Tailwind CSS

**Depends on:** Phase 3a (Backend)

---

## File Structure

### New Files
- `app/src/app/draft/[id]/live/page.tsx` — TV/laptop admin draft board page
- `app/src/components/LivePlayerSidebar.tsx` — Searchable player list for making picks

### Modified Files
- `app/src/components/DraftGrid.tsx` — Adapt for multi-user: row highlighting, "Picking..." cell, Supabase data

---

### Task 1: Create LivePlayerSidebar Component

**Files:**
- Create: `app/src/components/LivePlayerSidebar.tsx`

- [ ] **Step 1: Create the player sidebar component**

This is the right column on the TV view — shows who's picking and a searchable list of available players. Clicking a player calls `onPickPlayer`.

Write `app/src/components/LivePlayerSidebar.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Player } from '@/types/player';
import { ParticipantData } from '@/hooks/useDraftState';
import TeamLogo from './TeamLogo';
import InjuryFlag from './InjuryFlag';

interface LivePlayerSidebarProps {
  availablePlayers: Player[];
  currentParticipant: ParticipantData | null;
  participants: ParticipantData[];
  isDraftComplete: boolean;
  pickTimerSeconds: number | null;
  onPickPlayer: (player: Player) => void;
  loading: boolean;
}

export default function LivePlayerSidebar({
  availablePlayers,
  currentParticipant,
  participants,
  isDraftComplete,
  pickTimerSeconds,
  onPickPlayer,
  loading,
}: LivePlayerSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  const filtered = availablePlayers.filter(p => {
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'ALL' || p.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  const positions = ['ALL', 'C', 'LW', 'RW', 'D'];

  return (
    <div className="w-96 shrink-0 border-l border-[#141e12] bg-[#0a0f0a] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#141e12] shrink-0">
        {!isDraftComplete && currentParticipant ? (
          <div>
            <div className="text-xs text-[#5a6b57] mb-1">Pick for</div>
            <div className="text-lg font-bold text-[#6b9b7a]">{currentParticipant.team_name}</div>
            {pickTimerSeconds && (
              <div className="text-xs text-[#5a6b57] mt-1">Timer: {pickTimerSeconds}s per pick</div>
            )}
          </div>
        ) : isDraftComplete ? (
          <div className="text-lg font-bold text-[#6b9b7a]">Draft Complete!</div>
        ) : (
          <div className="text-sm text-[#5a6b57]">Waiting...</div>
        )}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-[#141e12] shrink-0">
        <input
          type="text"
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-[#141e12] rounded-lg bg-[#050a05] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
        />
        <div className="flex gap-1 mt-2">
          {positions.map(pos => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                positionFilter === pos
                  ? 'bg-[#4a7c59] text-[#c8d9c3]'
                  : 'text-[#5a6b57] hover:bg-[#141e12]'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Player List */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center text-[#5a6b57] py-8">Loading players...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-[#5a6b57] py-8">No players match</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(player => (
              <div
                key={player.name}
                onClick={() => !isDraftComplete && onPickPlayer(player)}
                className={`flex items-center gap-3 p-3 border border-[#141e12] rounded-lg bg-[#050a05] transition-all ${
                  !isDraftComplete ? 'cursor-pointer hover:border-[#4a7c59] hover:bg-[#0a0f0a]' : 'opacity-60'
                }`}
              >
                <div className="text-sm text-[#5a6b57] font-semibold w-8">#{player.rank}</div>
                <TeamLogo team={player.team} className="w-8 h-8" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-[#c8d9c3] truncate">{player.name}</div>
                    <InjuryFlag player={player} />
                  </div>
                  <div className="text-xs text-[#5a6b57]">{player.team} &bull; {player.position}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-[#6b9b7a]">
                    {player.projectedPlayoffPoints.toFixed(1)}
                  </div>
                  <div className="text-xs text-[#5a6b57]">{player.projectedPlayoffGames.toFixed(1)} gp</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/LivePlayerSidebar.tsx
git commit -m "feat: add LivePlayerSidebar component with search, filter, and pick"
```

---

### Task 2: Create Live Draft Board Page

**Files:**
- Create: `app/src/app/draft/[id]/live/page.tsx`

First: `mkdir -p app/src/app/draft/\[id\]/live`

- [ ] **Step 1: Create the live draft page**

Write `app/src/app/draft/[id]/live/page.tsx`:

```typescript
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDraftState } from '@/hooks/useDraftState';
import { Player } from '@/types/player';
import LivePlayerSidebar from '@/components/LivePlayerSidebar';
import Link from 'next/link';

export default function LiveDraftPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;

  const {
    draft,
    participants,
    picks,
    players,
    availablePlayers,
    loading,
    isAdmin,
    managers,
    currentRound,
    currentPick,
    currentPosition,
    currentParticipant,
    isDraftComplete,
    refresh,
  } = useDraftState(draftId);

  const handlePickPlayer = async (player: Player) => {
    if (!draft || !currentParticipant) return;

    const res = await fetch(`/api/drafts/${draftId}/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: currentParticipant.id,
        player_id: player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        player_name: player.name,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to make pick');
    }
  };

  const handleUndo = async () => {
    if (!confirm('Undo the last pick?')) return;

    const res = await fetch(`/api/drafts/${draftId}/picks/last`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to undo');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading draft...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-4">Draft Not Found</h1>
          <Link href="/dashboard" className="text-[#6b9b7a] hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-4">Admin Only</h1>
          <p className="text-[#5a6b57] mb-4">This view is for the draft admin.</p>
          <Link href={`/draft/${draftId}/team`} className="text-[#6b9b7a] hover:underline">Go to your team view</Link>
        </div>
      </div>
    );
  }

  if (draft.status !== 'in_progress' && draft.status !== 'complete') {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-4">Draft Not Started</h1>
          <p className="text-[#5a6b57] mb-4">Start the draft from the dashboard first.</p>
          <Link href={`/dashboard/drafts/${draftId}`} className="text-[#6b9b7a] hover:underline">Go to Draft Settings</Link>
        </div>
      </div>
    );
  }

  const totalPicks = managers * draft.players_per_team;
  const currentPickNumber = (currentRound - 1) * managers + currentPick;

  return (
    <div className="min-h-screen bg-[#050a05] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#141e12] shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#c8d9c3]">{draft.name}</h1>
            {!isDraftComplete && currentParticipant && (
              <div className="mt-1">
                <span className="inline-block bg-[#4a7c59] text-[#c8d9c3] px-4 py-1.5 rounded-lg font-bold text-sm">
                  ON THE CLOCK: {currentParticipant.team_name}
                </span>
                <span className="ml-3 text-sm text-[#5a6b57]">
                  Round {currentRound}, Pick {currentPick} (#{currentPickNumber} overall)
                  {draft.pick_timer_seconds && ` — Timer: ${draft.pick_timer_seconds}s`}
                </span>
              </div>
            )}
            {isDraftComplete && (
              <span className="inline-block bg-[#4a7c59] text-[#c8d9c3] px-4 py-1.5 rounded-lg font-bold text-sm mt-1">
                Draft Complete!
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {!isDraftComplete && picks.length > 0 && (
              <button
                onClick={handleUndo}
                className="px-3 py-1.5 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
              >
                Undo
              </button>
            )}
            <span className="text-sm text-[#5a6b57] py-1.5">
              {picks.length} / {totalPicks} picks
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Draft Board */}
        <div className="flex-1 overflow-auto p-4">
          <DraftBoardGrid
            participants={participants}
            picks={picks}
            players={players}
            currentRound={currentRound}
            currentPick={currentPick}
            currentPosition={currentPosition}
            managers={managers}
            playersPerTeam={draft.players_per_team}
            isDraftComplete={isDraftComplete}
            adminUserId={draft.admin_user_id}
            currentUserId={null}
          />
        </div>

        {/* Player Sidebar */}
        <LivePlayerSidebar
          availablePlayers={availablePlayers}
          currentParticipant={currentParticipant}
          participants={participants}
          isDraftComplete={isDraftComplete}
          pickTimerSeconds={draft.pick_timer_seconds}
          onPickPlayer={handlePickPlayer}
          loading={loading}
        />
      </div>
    </div>
  );
}

// Inline draft board grid for multi-user live view
function DraftBoardGrid({
  participants,
  picks,
  players,
  currentRound,
  currentPick,
  currentPosition,
  managers,
  playersPerTeam,
  isDraftComplete,
  adminUserId,
  currentUserId,
}: {
  participants: { id: string; team_name: string; draft_position: number | null; user_id: string }[];
  picks: { round: number; manager_index: number; player_id: string; player_name: string }[];
  players: Player[];
  currentRound: number;
  currentPick: number;
  currentPosition: number;
  managers: number;
  playersPerTeam: number;
  isDraftComplete: boolean;
  adminUserId: string;
  currentUserId: string | null;
}) {
  const participantByPosition = new Map<number, typeof participants[0]>();
  participants.forEach(p => {
    if (p.draft_position != null) participantByPosition.set(p.draft_position, p);
  });

  const adminParticipant = participants.find(p => p.user_id === adminUserId);

  return (
    <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#4a7c59] text-[#c8d9c3]">
              <th className="px-3 py-2 text-left font-semibold text-xs border-r border-[#3d664a] whitespace-nowrap">
                MANAGER
              </th>
              {Array.from({ length: playersPerTeam }, (_, i) => (
                <th key={i} className="px-2 py-2 text-center font-semibold text-xs border-r border-[#3d664a] min-w-[80px]">
                  R{i + 1}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-xs">PTS</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: managers }, (_, posIndex) => {
              const position = posIndex + 1;
              const participant = participantByPosition.get(position);
              const isCurrentRow = position === currentPosition && !isDraftComplete;
              const isAdminRow = participant?.user_id === adminUserId;

              const rowPicks = picks.filter(p => p.manager_index === position);
              const projectedPts = rowPicks.reduce((total, pick) => {
                const player = players.find(p => p.name === pick.player_name);
                return total + (player?.projectedPlayoffPoints || 0);
              }, 0);

              return (
                <tr
                  key={position}
                  className={`border-b border-[#141e12] ${
                    isAdminRow ? 'bg-[#1a2f1a]' : ''
                  } ${
                    isCurrentRow && !isAdminRow ? 'bg-[#2a4a2a]' : ''
                  } ${
                    isCurrentRow && isAdminRow ? 'bg-[#2a4a2a]' : ''
                  }`}
                >
                  <td className={`px-3 py-2 border-r border-[#141e12] font-semibold text-xs whitespace-nowrap ${
                    isAdminRow ? 'text-[#4a7c59]' : 'text-[#c8d9c3]'
                  }`}>
                    <div className="flex items-center gap-1">
                      {participant?.team_name || `Position ${position}`}
                      {isAdminRow && <span className="text-[10px] text-[#4a7c59]">(YOU)</span>}
                      {isCurrentRow && <span className="text-[10px] text-[#6b9b7a]">&larr;</span>}
                    </div>
                  </td>
                  {Array.from({ length: playersPerTeam }, (_, roundIndex) => {
                    const round = roundIndex + 1;
                    const pick = picks.find(p => p.manager_index === position && p.round === round);
                    const isCurrentCell = isCurrentRow && round === currentRound;
                    const player = pick ? players.find(p => p.name === pick.player_name) : null;

                    return (
                      <td key={roundIndex} className={`px-1 py-1 border-r border-[#141e12] text-center ${
                        isCurrentCell ? 'bg-[#4a7c59]' : ''
                      }`}>
                        {pick ? (
                          <div className="p-1 border border-[#141e12] bg-[#050a05] rounded">
                            <div className="text-xs font-medium text-[#c8d9c3] leading-tight">{pick.player_name}</div>
                            <div className="flex items-center justify-center gap-0.5">
                              {player && <TeamLogoInline team={player.team} />}
                              {player && <span className="text-xs text-[#5a6b57]">{player.position}</span>}
                            </div>
                          </div>
                        ) : isCurrentCell ? (
                          <div className="p-1 text-xs text-[#c8d9c3] font-bold animate-pulse">
                            Picking...
                          </div>
                        ) : (
                          <div className="text-xs text-[#5a6b57]">-</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs font-bold text-[#6b9b7a]">
                      {projectedPts > 0 ? projectedPts.toFixed(1) : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamLogoInline({ team }: { team: string }) {
  const teamLogos: Record<string, string> = {
    'ANA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ana.png',
    'BOS': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/bos.png',
    'BUF': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/buf.png',
    'CAR': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/car.png',
    'COL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/col.png',
    'DAL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/dal.png',
    'EDM': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/edm.png',
    'FLA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/fla.png',
    'LAK': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/la.png',
    'MIN': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/min.png',
    'MTL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/mtl.png',
    'NJD': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nj.png',
    'NYI': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyi.png',
    'NYR': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyr.png',
    'OTT': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ott.png',
    'PHI': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/phi.png',
    'PIT': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/pit.png',
    'TBL': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tb.png',
    'TOR': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tor.png',
    'UTA': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/uta.png',
    'VAN': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/van.png',
    'VGK': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/vgk.png',
    'WPG': 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/wpg.png',
  };

  const url = teamLogos[team.toUpperCase()];
  if (!url) return <span className="text-[8px] text-[#5a6b57]">{team}</span>;

  return (
    <img
      src={url}
      alt={team}
      className="w-3 h-3 object-contain inline-block"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/
git commit -m "feat: add live draft board page with grid, sidebar, ON THE CLOCK, and undo"
```

---

### Task 3: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 2: Run build**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run lint`
Expected: Only warnings (no errors)
