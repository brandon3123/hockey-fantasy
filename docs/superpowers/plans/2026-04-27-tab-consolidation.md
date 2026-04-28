# Tab Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate duplicated tab implementations into shared components: `DraftBoard` (board tab), `PlayerList` (player lists). Delete `LivePlayerSidebar`, `FullPlayerList`, and `MiniDraftBoard`.

**Architecture:** Create two new shared components. `DraftBoard` extracts the coach page's inline board table. `PlayerList` replaces `LivePlayerSidebar` and `FullPlayerList` with configurable props for search, pick ability, and loading states. Then update all 3 views (live, coach, team) to use the new components. Delete the old components.

**Tech Stack:** React, TypeScript, Next.js, Tailwind CSS

---

### Task 1: Create `DraftBoard` component

**Files:**
- Create: `app/src/components/DraftBoard.tsx`

Extract the coach page's inline board (lines 241-310 of `app/src/app/draft/[id]/coach/page.tsx`) into a standalone component.

- [ ] **Step 1: Create `DraftBoard.tsx`**

```tsx
'use client';

import { useMemo } from 'react';
import { DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import { Player } from '@/types/player';
import TeamLogo from './TeamLogo';

interface DraftBoardProps {
  participants: ParticipantData[];
  picks: DraftPickRow[];
  players: Player[];
  playersPerTeam: number;
  currentRound: number;
  currentParticipant: ParticipantData | null;
}

export default function DraftBoard({
  participants,
  picks,
  players,
  playersPerTeam,
  currentRound,
  currentParticipant,
}: DraftBoardProps) {
  const sorted = useMemo(
    () => [...participants].sort((a, b) => (a.draft_position ?? 0) - (b.draft_position ?? 0)),
    [participants]
  );

  return (
    <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#4a7c59] text-[#c8d9c3]">
              <th className="px-2 py-1.5 text-left font-semibold border-r border-[#3d664a] whitespace-nowrap">
                MGR
              </th>
              {Array.from({ length: playersPerTeam }, (_, i) => (
                <th key={i} className="px-1 py-1.5 text-center font-semibold border-r border-[#3d664a] min-w-[50px]">
                  R{i + 1}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center font-semibold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((participant) => {
              const isCurrent = currentParticipant?.id === participant.id;
              const pts = picks
                .filter((p) => p.participant_id === participant.id)
                .reduce((total, pick) => {
                  const player = players.find((pl) => pl.name === pick.player_name);
                  return total + (player?.displayPoints || 0);
                }, 0);
              return (
                <tr key={participant.id} className={`border-b border-[#141e12] ${isCurrent ? 'bg-[#2a4a2a]' : 'bg-[#050a05]'}`}>
                  <td className="px-2 py-1 border-r border-[#141e12]">
                    <span className={`text-[10px] font-semibold ${isCurrent ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                      {participant.team_name}
                    </span>
                  </td>
                  {Array.from({ length: playersPerTeam }, (_, roundIndex) => {
                    const round = roundIndex + 1;
                    const pick = picks.find((p) => p.participant_id === participant.id && p.round === round);
                    const isCell = isCurrent && round === currentRound;
                    const player = pick ? players.find((pl) => pl.name === pick.player_name) : null;
                    return (
                      <td key={roundIndex} className={`px-0.5 py-0.5 border-r border-[#141e12] text-center ${isCell ? 'bg-[#1a2f1a]' : ''}`}>
                        {pick ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-[10px] text-[#c8d9c3] truncate max-w-[50px]">
                              {pick.player_name.split(' ').pop()}
                            </span>
                            {player && (
                              <TeamLogo team={player.team} className="w-3 h-3" />
                            )}
                          </div>
                        ) : isCell ? (
                          <div className="text-[10px] text-[#6b9b7a] animate-pulse font-semibold">Picking...</div>
                        ) : (
                          <span className="text-[#2d3c28]">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    <span className="text-[10px] font-bold text-[#6b9b7a]">
                      {pts > 0 ? pts.toFixed(1) : '-'}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DraftBoard.tsx
git commit -m "Add shared DraftBoard component"
```

---

### Task 2: Replace inline boards on coach and team pages with `DraftBoard`

**Files:**
- Modify: `app/src/app/draft/[id]/coach/page.tsx` — replace lines 240-311 (inline board) with `<DraftBoard>` component
- Modify: `app/src/app/draft/[id]/team/page.tsx` — delete `MiniDraftBoard` function (lines 14-96), replace usage with `<DraftBoard>`, remove unused `teamLogos` map and `TeamLogoInline`

- [ ] **Step 1: Update coach page**

Add import:
```tsx
import DraftBoard from '@/components/DraftBoard';
```

Replace the `{activeTab === 'board' && ( ... )}` block (lines 240-311) with:
```tsx
        {activeTab === 'board' && (
          <DraftBoard
            participants={participants}
            picks={picks}
            players={players}
            playersPerTeam={draft.players_per_team}
            currentRound={currentRound}
            currentParticipant={currentParticipant}
          />
        )}
```

Remove the `TeamLogo` import if no longer used directly (check other tabs first — it's only used in the board inline code on coach page).

- [ ] **Step 2: Update team page**

Add import:
```tsx
import DraftBoard from '@/components/DraftBoard';
```

Delete the entire `MiniDraftBoard` function (the local component definition). Replace the board tab usage:
```tsx
        {activeTab === 'board' && (
          <DraftBoard
            participants={participants}
            picks={picks}
            players={players}
            playersPerTeam={draft.players_per_team}
            currentRound={currentRound}
            currentParticipant={currentParticipant}
          />
        )}
```

Remove the `useMemo` import if no longer used in the file (check — `MiniDraftBoard` was the only user of `useMemo` in the local scope; the main component also uses it, so keep the import).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/src/app/draft/[id]/coach/page.tsx app/src/app/draft/[id]/team/page.tsx
git commit -m "Replace inline draft boards with shared DraftBoard component"
```

---

### Task 3: Create `PlayerList` component

**Files:**
- Create: `app/src/components/PlayerList.tsx`

This replaces `LivePlayerSidebar` and `FullPlayerList`. Based on `LivePlayerSidebar`'s player card design (compact row with rank badge, logo, name, injury, points, PPG). Always shows PPG.

- [ ] **Step 1: Create `PlayerList.tsx`**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { Player } from '@/types/player';
import { ParticipantData } from '@/hooks/useDraftState';
import TeamLogo from './TeamLogo';
import InjuryFlag, { isPlayerPickable } from './InjuryFlag';

interface PlayerListProps {
  availablePlayers: Player[];
  onPickPlayer?: (player: Player) => void;
  loading?: boolean;
  picking?: boolean;
  isDraftComplete?: boolean;
  currentParticipant?: ParticipantData | null;
  pickTimerSeconds?: number | null;
  showSearch?: boolean;
  showHeader?: boolean;
  maxPlayers?: number;
}

export default function PlayerList({
  availablePlayers,
  onPickPlayer,
  loading = false,
  picking = false,
  isDraftComplete = false,
  currentParticipant = null,
  pickTimerSeconds = null,
  showSearch = true,
  showHeader = false,
  maxPlayers,
}: PlayerListProps) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  const filteredPlayers = useMemo(() => {
    let result = [...availablePlayers];
    if (positionFilter !== 'ALL') {
      result = result.filter((p) => p.position === positionFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q)
      );
    }
    if (maxPlayers) {
      result = result.slice(0, maxPlayers);
    }
    return result;
  }, [availablePlayers, positionFilter, search, maxPlayers]);

  const positions = ['ALL', 'C', 'LW', 'RW', 'D'];

  const canPick = !!onPickPlayer && !isDraftComplete;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {showHeader && (
        <div className="p-4 border-b border-[#141e12] bg-[#0a0f0a]">
          <div className="text-sm font-semibold text-[#5a6b57] mb-1">
            PICKING FOR
          </div>
          <div className="text-lg font-bold text-[#c8d9c3]">
            {isDraftComplete
              ? 'Draft Complete!'
              : currentParticipant?.team_name || 'Waiting...'}
          </div>
          {pickTimerSeconds && !isDraftComplete && (
            <div className="text-xs text-[#5a6b57] mt-1">
              {pickTimerSeconds}s per pick
            </div>
          )}
        </div>
      )}

      {showSearch && (
        <>
          <div className="p-3 border-b border-[#141e12]">
            <input
              type="text"
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-[#141e12] rounded-lg bg-[#0a0f0a] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
            />
          </div>

          <div className="flex gap-1 p-2 border-b border-[#141e12]">
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition-colors ${
                  positionFilter === pos
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto relative">
        {picking && (
          <div className="absolute inset-0 bg-[#050a05]/80 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#4a7c59] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#6b9b7a]">Making pick...</span>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-4 text-center text-[#5a6b57] text-sm">
            Loading players...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-4 text-center text-[#5a6b57] text-sm">
            No players found
          </div>
        ) : (
          filteredPlayers.map((player, index) => {
            const pickable = canPick && isPlayerPickable(player);
            return (
              <div
                key={`${player.name}-${player.team}-${player.position}`}
                onClick={() => {
                  if (pickable) onPickPlayer!(player);
                }}
                className={`flex items-center gap-3 p-3 border-b border-[#141e12] transition-colors ${
                  isDraftComplete
                    ? 'opacity-50 cursor-not-allowed'
                    : !isPlayerPickable(player)
                    ? 'opacity-40 cursor-not-allowed'
                    : pickable
                    ? 'cursor-pointer hover:bg-[#0a0f0a]'
                    : 'cursor-default'
                } ${index === 0 ? 'bg-[#0a0f0a] border-l-2 border-l-[#4a7c59]' : ''}`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    index === 0
                      ? 'bg-[#4a7c59] text-[#c8d9c3]'
                      : 'bg-[#141e12] text-[#5a6b57]'
                  }`}
                >
                  #{player.rank}
                </div>
                <TeamLogo team={player.team} className="w-8 h-8 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-[#c8d9c3] truncate">
                      {player.name}
                    </span>
                    <InjuryFlag player={player} />
                  </div>
                  <div className="text-xs text-[#5a6b57]">
                    {player.team} &bull; {player.position} &bull; {player.pointsPerGame.toFixed(2)} ppg
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-[#6b9b7a]">
                    {player.displayPoints.toFixed(1)}
                  </div>
                  <div className="text-xs text-[#5a6b57]">
                    pts
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/PlayerList.tsx
git commit -m "Add shared PlayerList component"
```

---

### Task 4: Replace `LivePlayerSidebar` in live page with `PlayerList`

**Files:**
- Modify: `app/src/app/draft/[id]/live/page.tsx` — replace `LivePlayerSidebar` import and usage with `PlayerList`

- [ ] **Step 1: Update live page**

Replace import:
```tsx
import LivePlayerSidebar from '@/components/LivePlayerSidebar';
```
With:
```tsx
import PlayerList from '@/components/PlayerList';
```

Replace the `<LivePlayerSidebar ... />` usage (in the `sidebarTab === 'players'` branch) with:
```tsx
            <PlayerList
              availablePlayers={availablePlayers}
              onPickPlayer={handlePickPlayer}
              loading={loading}
              picking={picking}
              isDraftComplete={isDraftComplete}
              currentParticipant={currentParticipant}
              pickTimerSeconds={draft.pick_timer_seconds}
              showSearch={true}
              showHeader={true}
            />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/[id]/live/page.tsx
git commit -m "Replace LivePlayerSidebar with PlayerList on live page"
```

---

### Task 5: Replace `FullPlayerList` in coach and team pages with `PlayerList`

**Files:**
- Modify: `app/src/app/draft/[id]/coach/page.tsx` — replace `FullPlayerList` import and usage with `PlayerList`
- Modify: `app/src/app/draft/[id]/team/page.tsx` — replace `FullPlayerList` import and usage with `PlayerList`

- [ ] **Step 1: Update coach page**

Replace import:
```tsx
import FullPlayerList from '@/components/FullPlayerList';
```
With:
```tsx
import PlayerList from '@/components/PlayerList';
```

Replace the `{activeTab === 'all' && ( ... )}` block with:
```tsx
        {activeTab === 'all' && (
          <PlayerList
            availablePlayers={availablePlayers}
            onPickPlayer={handleDraftPlayer}
            isDraftComplete={isDraftComplete}
            showSearch={true}
          />
        )}
```

- [ ] **Step 2: Update team page**

Replace import:
```tsx
import FullPlayerList from '@/components/FullPlayerList';
```
With:
```tsx
import PlayerList from '@/components/PlayerList';
```

Replace the `{activeTab === 'available' && ( ... )}` block with:
```tsx
        {activeTab === 'available' && (
          <>
            {draft.pick_entry_mode === 'admin_only' && !isDraftComplete && !isMyTurn && (
              <div className="px-4 py-2">
                <div className="px-4 py-2 bg-[#0a0f0a] border border-[#141e12] rounded-lg text-center text-sm text-[#5a6b57]">
                  Tell the admin your pick!
                </div>
              </div>
            )}
            <PlayerList
              availablePlayers={availablePlayers}
              onPickPlayer={isSelfDraft ? handleDraftPlayer : undefined}
              isDraftComplete={isDraftComplete}
              showSearch={true}
            />
          </>
        )}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/src/app/draft/[id]/coach/page.tsx app/src/app/draft/[id]/team/page.tsx
git commit -m "Replace FullPlayerList with PlayerList on coach and team pages"
```

---

### Task 6: Delete old components and verify build

**Files:**
- Delete: `app/src/components/LivePlayerSidebar.tsx`
- Delete: `app/src/components/FullPlayerList.tsx`

`BestAvailable.tsx` stays (has unique coaching features). `MiniDraftBoard` was already removed in Task 2.

- [ ] **Step 1: Delete old files**

```bash
rm app/src/components/LivePlayerSidebar.tsx app/src/components/FullPlayerList.tsx
```

- [ ] **Step 2: Verify no remaining imports of deleted components**

Run: `cd app && grep -r "LivePlayerSidebar\|FullPlayerList" src/`
Expected: No matches

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify build**

Run: `cd app && npx next build`
Expected: Successful build with no errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove LivePlayerSidebar and FullPlayerList - replaced by shared PlayerList"
```
