# Remove manager_index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant `manager_index` column/concept. Use `participant_id` to identify pick ownership everywhere.

**Architecture:** Remove `manager_index` from DB inserts, remove from `DraftPickRow` type, and replace `managerIndex` in legacy `DraftPick` with `participantId`. Update all consumers to filter picks by `participant_id` instead of integer index. The `yourPosition` field in `DraftState` becomes unnecessary for the real draft coach (replaced by `yourParticipantId`), but stays for the legacy `/draft` simulator.

**Tech Stack:** TypeScript, React, Next.js, Supabase

---

### Task 1: Remove manager_index from API layer

**Files:**
- Modify: `app/src/app/api/drafts/[id]/picks/route.ts:128`
- Modify: `app/src/app/api/drafts/[id]/picks/replace/route.ts:40,86`

- [ ] **Step 1: Remove from picks insert**

In `app/src/app/api/drafts/[id]/picks/route.ts`, remove the `manager_index` line from the insert object:

```typescript
.insert({
  draft_id: id,
  round,
  pick_number: pickNumber,
  participant_id,
  player_id,
  player_name: player_name || null,
});
```

- [ ] **Step 2: Remove from replace route select and insert**

In `app/src/app/api/drafts/[id]/picks/replace/route.ts`:

Change the select (line ~40) from:
```typescript
.select('id, draft_id, round, pick_number, manager_index, participant_id')
```
to:
```typescript
.select('id, draft_id, round, pick_number, participant_id')
```

Change the insert (line ~86) from:
```typescript
.insert({
  draft_id: id,
  round: existingPick.round,
  pick_number: existingPick.pick_number,
  manager_index: existingPick.manager_index,
  participant_id: existingPick.participant_id,
  player_id: new_player_id,
  player_name: new_player_name || null,
});
```
to:
```typescript
.insert({
  draft_id: id,
  round: existingPick.round,
  pick_number: existingPick.pick_number,
  participant_id: existingPick.participant_id,
  player_id: new_player_id,
  player_name: new_player_name || null,
});
```

- [ ] **Step 3: Remove from DraftPickRow type**

In `app/src/hooks/useDraftRealtime.ts`, remove `manager_index: number` from the `DraftPickRow` interface.

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit` from `app/` directory
Expected: Errors in files that still reference `manager_index` on `DraftPickRow` — these will be fixed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/drafts/[id]/picks/route.ts app/src/app/api/drafts/[id]/picks/replace/route.ts app/src/hooks/useDraftRealtime.ts
git commit -m "remove manager_index from API layer and DraftPickRow type"
```

---

### Task 2: Update coach page to use participant_id

**Files:**
- Modify: `app/src/app/draft/[id]/coach/page.tsx:26-31,245-250`

- [ ] **Step 1: Update mapToLegacyDraftState**

In `app/src/app/draft/[id]/coach/page.tsx`, change the `legacyPicks` mapping:

```typescript
const legacyPicks: DraftPick[] = picks.map((p) => ({
  playerId: p.player_id,
  playerName: p.player_name,
  round: p.round,
  participantId: p.participant_id,
}));
```

Also update the `DraftState` return to use `yourParticipantId`:

```typescript
return {
  managers: participants.length,
  yourPosition: adminPosition,
  yourParticipantId: adminParticipant?.id ?? '',
  playersPerTeam: draft.players_per_team,
  currentRound: draft.current_round,
  currentPick: draft.current_pick,
  picks: legacyPicks,
  availablePlayers,
};
```

- [ ] **Step 2: Update TeamStackPanel yourPicks mapping**

In the same file, change line ~245-250:

```typescript
yourPicks={adminPicks.map((p) => ({
  playerId: p.player_id,
  playerName: p.player_name,
  round: p.round,
  participantId: p.participant_id,
}))}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/[id]/coach/page.tsx
git commit -m "update coach page to use participant_id instead of manager_index"
```

---

### Task 3: Update DraftPick type and DraftState

**Files:**
- Modify: `app/src/types/player.ts:42-57`

- [ ] **Step 1: Update types**

Replace the `DraftPick` and `DraftState` types:

```typescript
export interface DraftPick {
  playerId: string;
  playerName: string;
  round: number;
  participantId: string;
}

export interface DraftState {
  managers: number;
  yourPosition: number;
  yourParticipantId: string;
  playersPerTeam: number;
  currentRound: number;
  currentPick: number;
  picks: DraftPick[];
  availablePlayers: Player[];
}
```

- [ ] **Step 2: Verify typecheck shows remaining errors**

Run: `npx tsc --noEmit` from `app/` directory
Expected: Errors in draft-coach.ts, draft-logic.ts, DraftGrid.tsx, draft/page.tsx, rosters/page.tsx, TeamCompositionVisualizer.tsx, PositionTracker.tsx — all need `managerIndex` → `participantId` updates.

- [ ] **Step 3: Commit**

```bash
git add app/src/types/player.ts
git commit -m "update DraftPick and DraftState types to use participantId"
```

---

### Task 4: Update draft-logic.ts

**Files:**
- Modify: `app/src/lib/draft-logic.ts`

- [ ] **Step 1: Update all functions**

`assignPlayerToManager` (line ~62-67): The client-side simulator doesn't have real participant IDs, so generate a synthetic one based on manager index:

```typescript
export function assignPlayerToManager(
  state: DraftState,
  playerId: string,
  playerName: string
): DraftState {
  const currentManager = getCurrentManager(state);

  const newPick: DraftPick = {
    playerId,
    playerName,
    round: state.currentRound,
    participantId: `manager-${currentManager - 1}`,
  };
```

`getManagerPicks` → rename to `getParticipantPicks`:

```typescript
export function getParticipantPicks(state: DraftState, participantId: string): DraftPick[] {
  return state.picks.filter(p => p.participantId === participantId);
}
```

Keep `getManagerPicks` as an alias for backward compat with the legacy `/draft` simulator (it uses `manager-N` IDs):

```typescript
export function getManagerPicks(state: DraftState, managerPosition: number): DraftPick[] {
  return state.picks.filter(p => p.participantId === `manager-${managerPosition}`);
}
```

`getTeamStackScore` (line ~84-91):

```typescript
export function getTeamStackScore(state: DraftState, team: string): number {
  const yourPicks = getParticipantPicks(state, state.yourParticipantId);
  return yourPicks.filter(p => {
    const player = state.availablePlayers.find(ap => ap.name === p.playerName);
    return 0;
  }).length;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/draft-logic.ts
git commit -m "update draft-logic to use participantId instead of managerIndex"
```

---

### Task 5: Update draft-coach.ts

**Files:**
- Modify: `app/src/lib/draft-coach.ts`

- [ ] **Step 1: Update OpponentState type**

Change `managerIndex` to `participantId` in the `OpponentState` interface (line ~44):

```typescript
interface OpponentState {
  participantId: string;
  needs: string[];
  positionNeeds: string[];
  likelyTargets: string[];
  stackConcern: 'high' | 'medium' | 'low';
}
```

- [ ] **Step 2: Update analyzeYourTeam**

Change line ~52:

```typescript
const yourPicks = getParticipantPicks(draftState, draftState.yourParticipantId);
```

Add the import: `getParticipantPicks` from `./draft-logic`.

- [ ] **Step 3: Update analyzeOpponents**

Change the loop to iterate over picks and group by participantId instead of using integer indices:

```typescript
export function analyzeOpponents(draftState: DraftState, lines: LineCombination[], availablePlayers: Player[] = [], allPlayers: Player[] = []): OpponentState[] {
  const opponents: OpponentState[] = [];
  const targetCounts = { C: 4, LW: 4, RW: 4, D: 6 };
  const playerPool = allPlayers.length > 0 ? allPlayers : availablePlayers;

  const participantIds = [...new Set(draftState.picks.map(p => p.participantId))]
    .filter(id => id !== draftState.yourParticipantId);

  for (const participantId of participantIds) {
    const picks = getParticipantPicks(draftState, participantId);

    const composition: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0 };
    const teams: Record<string, number> = {};
    const partialLines: LineCombination[] = [];

    picks.forEach(pick => {
      const player = playerPool.find(p => p.name === pick.playerName);
      if (player) {
        composition[player.position] = (composition[player.position] || 0) + 1;
        teams[player.team] = (teams[player.team] || 0) + 1;

        const playerLine = getPlayerLine(player.name, lines);
        if (playerLine) {
          const existingLine = partialLines.find(l => l.lineId === playerLine.lineId);
          if (!existingLine) {
            partialLines.push(playerLine);
          }
        }
      }
    });

    const needs: string[] = [];
    const positionNeeds: string[] = [];
    Object.entries(targetCounts).forEach(([pos, target]) => {
      const current = composition[pos] || 0;
      if (current < target) {
        needs.push(pos);
        positionNeeds.push(pos);
      }
    });

    const likelyTargets: string[] = [];
    partialLines.forEach(line => {
      const playersOnLine = picks.filter(pick =>
        line.players.includes(pick.playerName)
      ).length;

      if (playersOnLine >= 2) {
        line.players.forEach(playerName => {
          if (!picks.some(pick => pick.playerName === playerName)) {
            const player = playerPool.find(p => p.name === playerName);
            if (player) {
              likelyTargets.push(playerName);
            }
          }
        });
      }
    });

    const maxTeamCount = Math.max(...Object.values(teams), 0);
    let stackConcern: 'high' | 'medium' | 'low' = 'low';
    if (maxTeamCount >= 3) stackConcern = 'high';
    else if (maxTeamCount >= 2) stackConcern = 'medium';

    opponents.push({
      participantId,
      needs,
      positionNeeds,
      likelyTargets,
      stackConcern
    });
  }

  return opponents;
}
```

- [ ] **Step 4: Update reasoning to use participantId**

In `generateReasoning` (line ~355-357), change:

```typescript
blockingReasons.push(`Blocks ${opp.participantId} from targeting ${player.name}`);
```
and:
```typescript
blockingReasons.push(`Blocks ${opp.participantId} from getting ${player.position}`);
```

- [ ] **Step 5: Update DraftCoach component opponent display**

In `app/src/components/DraftCoach.tsx` (line ~98-101), the opponents are displayed as `Team ${idx + 1}`. Since we no longer have manager indices, we can keep the display format but derive it from the participantId or just use the index:

No change needed — the reduce already uses `idx + 1` for display.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/draft-coach.ts
git commit -m "update draft-coach to use participantId instead of managerIndex"
```

---

### Task 6: Update DraftGrid component

**Files:**
- Modify: `app/src/components/DraftGrid.tsx`

- [ ] **Step 1: Update grid construction**

The grid currently iterates `m` from 0 to `managers` and matches `pick.managerIndex === m`. Change to iterate over participant IDs derived from picks:

```typescript
const participantIds = Array.from({ length: managers }, (_, i) => `manager-${i}`);

const grid: (DraftPick | null)[][] = [];

for (let m = 0; m < managers; m++) {
  const row: (DraftPick | null)[] = [];
  for (let r = 1; r <= draftState.playersPerTeam; r++) {
    const pick = picks.find(
      p => p.participantId === participantIds[m] && p.round === r
    );
    row.push(pick || null);
  }
  grid.push(row);
}
```

- [ ] **Step 2: Update row rendering**

Lines 112-142: Change `managerIndex` references to use `participantIds[m]`:

```typescript
{grid.map((row, m) => {
  const pid = participantIds[m];
  const isYourRow = pid === draftState.yourParticipantId;
  const isCurrentRow = m === currentManager;
  const managerPicks = picks.filter(p => p.participantId === pid);
```

And the selected pick display (line ~212):

```typescript
{managerNames[m] || `Manager ${m + 1}`} | Round {selectedPick.round}
```

Update the replace pick filter (line ~72):

```typescript
p.participantId === selectedPick.participantId &&
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DraftGrid.tsx
git commit -m "update DraftGrid to use participantId"
```

---

### Task 7: Update legacy /draft page

**Files:**
- Modify: `app/src/app/draft/page.tsx`

- [ ] **Step 1: Update all managerIndex references**

This page uses the client-side simulation. Since `assignPlayerToManager` now creates picks with `participantId: 'manager-N'`, update:

- Line 125: `pick.managerIndex === currentManager - 1` → `pick.participantId === 'manager-' + (currentManager - 1)`
- Line 136: `?.managerIndex` → `?.participantId`
- Line 170: `lastPick.managerIndex` → find manager index from `lastPick.participantId` (parse the `manager-N` string)
- Line 171: `lastPick.managerIndex === draftState.yourPosition - 1` → `lastPick.participantId === draftState.yourParticipantId`
- Line 227: `managerIndex: pickToReplace.managerIndex` → `participantId: pickToReplace.participantId`
- Lines 251, 275, 405: `pick.managerIndex` → derive manager name from `pick.participantId`

Helper function for the legacy page:

```typescript
const getManagerIndex = (participantId: string) => {
  const match = participantId.match(/^manager-(\d+)$/);
  return match ? parseInt(match[1]) : 0;
};
```

Then use `managerNames[getManagerIndex(pick.participantId)]` wherever `managerNames[pick.managerIndex]` was used.

- [ ] **Step 2: Update initializeDraft**

The function from draft-logic.ts already handles this. No changes needed in the page itself for initialization.

- [ ] **Step 3: Update yourPicks derivation**

Line 395: `getManagerPicks(draftState, draftState.yourPosition - 1)` → `getParticipantPicks(draftState, draftState.yourParticipantId)`

Import `getParticipantPicks` instead of or in addition to `getManagerPicks`.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/draft/page.tsx
git commit -m "update legacy draft page to use participantId"
```

---

### Task 8: Update remaining components

**Files:**
- Modify: `app/src/components/TeamCompositionVisualizer.tsx:14`
- Modify: `app/src/components/PositionTracker.tsx:11`
- Modify: `app/src/app/rosters/page.tsx` (multiple lines)

- [ ] **Step 1: Update TeamCompositionVisualizer**

```typescript
const yourPicks = draftState.picks.filter(p => p.participantId === draftState.yourParticipantId);
```

- [ ] **Step 2: Update PositionTracker**

```typescript
const yourPicks = draftState.picks.filter(p => p.participantId === draftState.yourParticipantId);
```

- [ ] **Step 3: Update rosters page**

Replace all `managerIndex` with `participantId`. The rosters page uses `DraftState` from localStorage, so picks will have `participantId: 'manager-N'`. Use a helper to extract manager index:

```typescript
const getManagerIndex = (participantId: string) => {
  const match = participantId.match(/^manager-(\d+)$/);
  return match ? parseInt(match[1]) : 0;
};
```

Every `(p: { managerIndex: number })` type annotation becomes `(p: { participantId: string })`.
Every `p.managerIndex === i` becomes `getManagerIndex(p.participantId) === i`.
Every `managerIndex:` in object literals becomes `participantId: 'manager-' + i`.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/TeamCompositionVisualizer.tsx app/src/components/PositionTracker.tsx app/src/app/rosters/page.tsx
git commit -m "update remaining components to use participantId"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit` from `app/` directory
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build` from `app/` directory
Expected: Build succeeds

- [ ] **Step 3: Commit any fixes if needed**
