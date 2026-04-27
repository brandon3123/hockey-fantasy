# Phase 3c: Phone Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the DraftStartModal, MyTeamTab, TeamBrowserTab, admin coach page, and participant team page — all the phone-facing views.

**Architecture:** Reuses `useDraftState` hook from 3a. New shared components (MyTeamTab, TeamBrowserTab) used by both admin coach and participant pages. DraftStartModal is used from the dashboard draft detail page.

**Tech Stack:** Next.js 15 App Router, Supabase Realtime, TypeScript, Tailwind CSS

**Depends on:** Phase 3a (Backend), Phase 3b (TV Live Board — for LivePlayerSidebar pattern reference)

---

## File Structure

### New Files
- `app/src/components/DraftStartModal.tsx` — Modal to configure and start the draft
- `app/src/components/MyTeamTab.tsx` — Shows user's roster, position breakdown, stacks, next pick
- `app/src/components/TeamBrowserTab.tsx` — Grid of team logos, select to see players
- `app/src/app/draft/[id]/coach/page.tsx` — Admin's phone: My Team + Coach + Best + All + Stack + Teams tabs
- `app/src/app/draft/[id]/team/page.tsx` — Participant's phone: My Team + Available + Teams + Draft Board tabs

### Modified Files
- `app/src/app/dashboard/drafts/[id]/page.tsx` — Add "Start Draft" button that opens DraftStartModal

---

### Task 1: Create DraftStartModal Component

**Files:**
- Create: `app/src/components/DraftStartModal.tsx`

- [ ] **Step 1: Create the modal**

The modal lets the admin configure: draft order (randomize or manual), pick entry mode, optional timer. Shows all registered participants with position assignment UI.

Write `app/src/components/DraftStartModal.tsx` — a 'use client' component with props: `{ draftId: string, participants: Array<{id, team_name, draft_position}>, onStart: () => void, onClose: () => void }`.

State: `positions` (Map of participant_id → draft_position number), `mode` ('admin_only' | 'self_draft'), `timerEnabled` (boolean), `timerSeconds` (30|60|90|120), `randomize` (boolean), `loading`.

On randomize toggle: shuffle positions 1..N and assign. Otherwise show a select per participant to set position manually.

On submit: POST to `/api/drafts/${draftId}/start` with `{ positions: [...], pick_entry_mode: mode, pick_timer_seconds: timerEnabled ? timerSeconds : null }`. On success, call `onStart()` and redirect to `/draft/${draftId}/live`.

Style matches existing app: dark green theme, `bg-[#0a0f0a]` modal, green buttons.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DraftStartModal.tsx
git commit -m "feat: add DraftStartModal for configuring draft order, mode, and timer"
```

---

### Task 2: Create MyTeamTab Component

**Files:**
- Create: `app/src/components/MyTeamTab.tsx`

- [ ] **Step 1: Create the My Team tab**

Shared component used by both admin coach and participant pages.

Props: `{ picks: DraftPickRow[], participants: ParticipantData[], players: Player[], currentUserId: string, draft: DraftData, currentRound: number, currentPick: number, managers: number }`.

Finds the user's participant record via `currentUserId`. Filters picks for that participant's `draft_position`. Shows:
- Team name and pick count
- Roster list: each picked player with TeamLogo, name, position, round/pick info, projected points
- Position breakdown row: C: N, LW: N, RW: N, D: N
- Team stacks: "EDM: 2"
- Total projected points
- "Next pick" info: calculates which round/pick the user picks next based on their position and the snake order. Shows "N picks until your turn" or "Your turn!" if it is.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/MyTeamTab.tsx
git commit -m "feat: add MyTeamTab component with roster, stats, and next pick info"
```

---

### Task 3: Create TeamBrowserTab Component

**Files:**
- Create: `app/src/components/TeamBrowserTab.tsx`

- [ ] **Step 1: Create the Teams tab**

Shared component. Props: `{ players: Player[], picks: DraftPickRow[], participants: ParticipantData[], onDraftPlayer?: (player: Player) => void, isDraftComplete: boolean }`.

State: `selectedTeam: string | null`.

Computes: unique teams from players array, groups players by team. For each team, determines which players are drafted (cross-reference picks by player_name) and which are available.

UI:
- 4-column grid of team logos (use TeamLogo component, sized w-8 h-8). Selected team has `border-2 border-[#4a7c59] bg-[#1a2f1a]`.
- Below grid: if a team is selected, show team details panel:
  - Team logo + name + advancement odds (R1-R4 %) from the first player's `teamAdvancementOdds`
  - Count: "X available, Y drafted"
  - Player list: each player with TeamLogo, name, position, goals, assists, projected points
  - Drafted players: show badge "Drafted by [team_name]" or "Yours" (if current user's participant drafted them)
  - Available players: normal style, clickable if `onDraftPlayer` provided and draft not complete

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/TeamBrowserTab.tsx
git commit -m "feat: add TeamBrowserTab with team grid, player list, and draft status"
```

---

### Task 4: Create Admin Coach Page

**Files:**
- Create: `app/src/app/draft/[id]/coach/page.tsx`

First: `mkdir -p app/src/app/draft/\[id\]/coach`

- [ ] **Step 1: Create the admin coach page**

Uses `useDraftState(draftId)`. Tabs: My Team, Coach, Best, All, Stack, Teams.

Constructs a compatible `DraftState` object from the hook data for the existing DraftCoach, BestAvailable, FullPlayerList, TeamStackPanel components (these expect `DraftState` with `yourPosition`, `picks`, `availablePlayers`, etc.).

The key mapping: `yourPosition` = admin's `draft_position` from their participant record. `DraftState.picks` = hook picks mapped to `DraftPick[]` format. `DraftState.availablePlayers` = hook's `availablePlayers`.

`onDraftPlayer` for the coach/best/all tabs: in admin-only mode, this is a no-op (admin picks from TV only). In self-draft mode, calls POST `/api/drafts/${draftId}/picks`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/[id]/coach/
git commit -m "feat: add admin coach page with My Team, Coach, Best, All, Stack, Teams tabs"
```

---

### Task 5: Create Participant Team Page

**Files:**
- Create: `app/src/app/draft/[id]/team/page.tsx`

First: `mkdir -p app/src/app/draft/\[id\]/team`

- [ ] **Step 1: Create the participant team page**

Uses `useDraftState(draftId)`. Tabs: My Team, Available, Teams, Draft Board.

If no user or user not a participant, show message with link to join or sign in.

"My Team" tab: renders `MyTeamTab` with the user's data.
"Available" tab: renders player list similar to LivePlayerSidebar but standalone. Shows position filters. In self-draft mode, tapping a player calls POST `/api/drafts/${draftId}/picks`. In admin-only mode, list is read-only with message "Tell the admin your pick."
"Teams" tab: renders `TeamBrowserTab`.
"Draft Board" tab: inline read-only version of the DraftBoardGrid (same as TV view but without the sidebar and pick controls). Shows "Viewing draft board" header.

Status banner at top: if draft is in_progress and it's the user's turn, show green "Your turn!" banner. If draft hasn't started, show "Waiting for draft to start...". If complete, show "Draft Complete!".

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/draft/[id]/team/
git commit -m "feat: add participant team page with My Team, Available, Teams, Draft Board tabs"
```

---

### Task 6: Add Start Draft Button to Dashboard

**Files:**
- Modify: `app/src/app/dashboard/drafts/[id]/page.tsx`

- [ ] **Step 1: Add Start Draft button and modal**

In the draft detail page, when `draft.status === 'setup' || draft.status === 'inviting'`, and there are registered participants, show a "Start Draft" button next to the existing controls.

Add state: `showStartModal: boolean`. Import and render `DraftStartModal` when true.

On modal's `onStart` callback: close modal, redirect to `/dashboard/drafts/${draftId}` (refresh data).

Also: when `draft.status === 'in_progress'`, show a "Go to Live Draft" button linking to `/draft/${draftId}/live` (admin) or `/draft/${draftId}/team` (participant).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/dashboard/drafts/[id]/page.tsx app/src/components/DraftStartModal.tsx
git commit -m "feat: add start draft button and live draft links to dashboard"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 2: Run build**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run lint`
Expected: Only warnings (no errors)
