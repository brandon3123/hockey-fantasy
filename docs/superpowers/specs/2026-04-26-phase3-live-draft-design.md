# Phase 3: Live Draft Night — Design Spec

## Overview

Transform the existing single-user draft board into a multi-user live draft experience. The admin runs the draft from a laptop connected to a TV (projected for the room), while all participants (including the admin) use their phones for personal draft coaching and team tracking. Picks sync in real-time across all devices via Supabase Realtime.

## Architecture

**Real-time sync:** Supabase Realtime broadcasts `draft_picks` INSERT events to all subscribed clients. When a pick is made on the TV/laptop, all phones update instantly.

**Draft state source of truth:** The `draft_picks` table in Supabase. The `drafts` table tracks `current_round` and `current_pick`. Clients compute available players and turn order locally from the picks data.

**Player data:** Loaded from the `players` table (already populated by scraper). Each client fetches all players once on mount, then filters locally based on which players have been drafted.

## Device Roles

### TV / Laptop — Admin Draft Board

**Route:** `/draft/[id]/live`

Two-column layout:
- **Left (75%):** Draft board grid (reuses existing `DraftGrid` component adapted for multi-user). Managers as rows, rounds as columns. Each cell shows team logo, player name, position. Current picker's row is highlighted green. The active pick cell shows "Picking..." with a pulsing animation. Shows projected points total per team.
- **Right (25%):** Searchable player list sidebar. Shows "Pick for [Team Name]" header. Players listed with team logo (ESPN CDN), name, team, position, projected points, injury flags — matching existing `BestAvailable`/`FullPlayerList` styling. Click a player to assign the pick.

**Header:** "ON THE CLOCK: [Team Name]" banner with round/pick info and optional countdown timer.

**Controls:** Undo Last Pick, Pause Draft.

**Access:** Admin only.

### Admin's Phone — Personal Draft Coach

**Route:** `/draft/[id]/coach`

Tabbed interface (same tabs as existing draft page, plus new tabs):
- **My Team** — Admin's roster with team logos, position breakdown, team stacks, total projected points, next pick info (which round/pick, how many picks until their turn).
- **Coach** — Strategy selector + top 3 recommendations with reasoning. Auto-updates as picks are made.
- **Best** — Best available players list.
- **All** — Full searchable/filterable player list.
- **Stack** — Team stacking analysis.
- **Teams** — Grid of team logos. Select a team to see all its players, advancement odds (R1-R4), who's been drafted (and by whom), and who's still available.

**Access:** Admin (who is also a participant).

### Participant's Phone

**Route:** `/draft/[id]/team`

Tabbed interface:
- **My Team** — Their roster with team logos, position breakdown, projected total, next pick info.
- **Available** — Searchable/filterable player list with position filters, team logos, injury flags. In self-draft mode, tapping a player drafts them. In admin-only mode, list is read-only.
- **Teams** — Same team browser as admin's phone. Grid of logos, select to see players, advancement odds, drafted/available status.
- **Draft Board** — Link to read-only view of the full draft board grid.

**Access:** Any participant in the draft.

## Draft Start Flow

Admin goes to draft detail page (`/dashboard/drafts/[id]`), all participants registered, clicks "Start Draft" to open a configuration modal:

1. **Draft order** — Randomize positions or manually assign draft positions to each participant. The admin is also assigned a position (they're a participant too).
2. **Pick entry mode** — Choose between:
   - **Admin-only:** Admin enters all picks from the TV/laptop. Participants have read-only phone views.
   - **Participant self-draft:** Each participant makes their own pick from their phone when it's their turn. Admin can still override from the TV.
3. **Timer (optional)** — Enable/disable. If enabled, set seconds per pick (30, 60, 90, 120). On expiry, auto-picks the best available player for that team.

On submit:
- `draft_participants.draft_position` is set for all participants
- `drafts.status` changes to `in_progress`
- `drafts.current_round` = 1, `drafts.current_pick` = 1
- Admin is redirected to `/draft/[id]/live`
- Participants see a "Draft has started!" banner on their team page

## Pick Flow

### Making a Pick (Admin-only mode)

1. TV shows "ON THE CLOCK: [Team Name]"
2. Admin searches/clicks a player from the sidebar
3. Client calls `POST /api/drafts/[id]/picks` with `{ participant_id, player_id, player_name }`
4. API inserts into `draft_picks`, updates `drafts.current_round` and `drafts.current_pick`
5. Supabase Realtime broadcasts the INSERT
6. All subscribed clients receive the event, update their local state
7. Next manager is highlighted, sidebar shows "Pick for [Next Team]"

### Making a Pick (Self-draft mode)

1. Participant sees "Your turn!" banner on their phone
2. They tap a player from the Available tab
3. Same API call and Realtime broadcast as above
4. If timer expires before they pick, auto-pick best available

### Undo

- Admin can undo the last pick from the TV view
- Calls `DELETE /api/drafts/[id]/picks/last`
- Reverts `drafts.current_round` and `current_pick`
- Realtime broadcasts the deletion

## New "Teams" Tab

Available on both admin coach view and participant phone view.

**UI:**
- Grid of NHL team logos (4 columns). Only teams with players in the pool are shown.
- Tap a team logo to select it (highlighted with green border)
- Below the grid: team details panel showing:
  - Team name and logo
  - Playoff advancement odds (R1%, R2%, R3%, R4%)
  - Count of players available vs drafted
  - Player list: each player shows team logo, name, position, goals, assists, projected points
  - Drafted players marked with "Drafted by [Team Name]" or "Yours" in red/green badge
  - Available players shown in normal style

**Data:** Players grouped by team from the players table. Cross-referenced with draft_picks to determine drafted/available status.

## Draft Board Highlighting

When a manager is on the clock:
- Their entire row gets a green-tinted background (`bg-[#1a2f1a]` → `bg-[#2a4a2a]`)
- Their name cell shows a left arrow indicator
- The current pick cell (where their next pick goes) shows "Picking..." in white text on a `bg-[#4a7c59]` background with a pulsing opacity animation
- The admin's own row always has a `bg-[#1a2f1a]` background with "(YOU)" label

## API Routes

### New Routes

- `POST /api/drafts/[id]/picks` — Make a pick. Validates: player not already drafted, it's the picker's turn (or admin overriding), draft is in_progress. Inserts into `draft_picks`, advances `drafts.current_round`/`current_pick`.
- `DELETE /api/drafts/[id]/picks/last` — Undo last pick. Admin-only. Deletes the last `draft_picks` record, reverts round/pick counters.
- `POST /api/drafts/[id]/start` — Start the draft. Sets positions, changes status to `in_progress`, creates admin's own participant record if missing.

### Modified Routes

- `GET /api/drafts/[id]` — Also returns `draft_picks` and player data needed for live draft.
- `PATCH /api/drafts/[id]` — Update draft status (pause, resume, complete).

## Data Model Changes

No new tables needed — `draft_picks` already exists in the schema from Phase 1. The `drafts` table already has `current_round` and `current_pick` columns.

Add one column to `drafts`:

```sql
ALTER TABLE drafts ADD COLUMN pick_entry_mode TEXT NOT NULL DEFAULT 'admin_only'
  CHECK (pick_entry_mode IN ('admin_only', 'self_draft'));
ALTER TABLE drafts ADD COLUMN pick_timer_seconds INTEGER;
```

## Component Reuse

Existing components to adapt (not rewrite):
- `DraftGrid` — Add multi-user support: row highlighting, "Picking..." cell, data from Supabase instead of localStorage
- `DraftCoach` — Add "My Team" tab, wire to Supabase Realtime for auto-updates
- `BestAvailable` — Wire to real-time available players list
- `FullPlayerList` — Wire to real-time available players list
- `TeamStackPanel` — Wire to real-time picks data
- `TeamLogo` — Used as-is
- `InjuryFlag` — Used as-is

New components:
- `TeamBrowserTab` — The "Teams" tab (team logo grid + selected team player list)
- `DraftStartModal` — Configuration modal for starting the draft (positions, mode, timer)
- `MyTeamTab` — Shows user's roster, position breakdown, stacks, next pick info
- `LivePlayerSidebar` — The player search/select panel on the TV view

## Realtime Subscription Setup

Each client subscribes to `draft_picks` changes for their draft:

```typescript
const channel = supabase
  .channel(`draft:${draftId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'draft_picks', filter: `draft_id=eq.${draftId}` },
    (payload) => { /* add pick to local state, recompute available players */ }
  )
  .on('postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'draft_picks', filter: `draft_id=eq.${draftId}` },
    (payload) => { /* remove pick from local state, restore player to available */ }
  )
  .subscribe();
```

## Snake Draft Logic

Reuse existing `calculateSnakePick`, `getCurrentManager`, `advanceDraft` from `draft-logic.ts`. The logic is already correct — even rounds reverse the order. The only change is the state source (Supabase instead of localStorage) and the `yourPosition` concept becomes the participant's `draft_position`.

## Draft Completion

When all picks are made (`current_round > players_per_team`):
- `drafts.status` changes to `complete`
- TV view shows a "Draft Complete!" banner with final standings
- All phones show final roster with projected totals
- Export to JSON/CSV still available
