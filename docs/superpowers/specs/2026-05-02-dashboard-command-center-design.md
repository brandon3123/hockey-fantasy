# Dashboard Command Center + /games Page

## Date: 2026-05-02

## Overview

Redesign the authenticated dashboard (`/`) from a plain "My Drafts" list into a command center that surfaces live draft data at a glance. Add a new `/games` page for tonight's NHL games.

## User Profile

- Single draft focus (most users have one active draft at a time)
- Wants to immediately see: their rank, team status, tonight's action, roster health

## Dashboard Layout

For authenticated users with at least one **complete** (actively scoring) draft:

### 1. Draft Status Bar (full width)
- Draft name, current round/series info
- User's rank (e.g. "3rd of 10 teams") — large, prominent
- Links to full standings

### 2. My Team Widget (full width)
- Grid of player cards (responsive: 5 cols desktop, 3 cols tablet, 2 cols mobile)
- Each card shows: team logo, player name, position, team abbreviation
- Yesterday's points: "+N pts" in green, or "—" if no score
- Injury badges: DTD (orange), OUT (red), ELIMINATED (red, dimmed + strikethrough)
- Summary bar: "N pts total | +N yesterday | View team →"
- "View team →" links to `/draft/[id]/team`
- If draft is not complete (setup/inviting/in_progress), show appropriate status instead (e.g. "Draft in progress", "Draft starts May 5")

### 3. Standings Snapshot (half width)
- Top 5 teams, user's team highlighted with green background
- Each row: rank, team name, total points
- "View full standings →" links to `/draft/[id]/standings`

### 4. Tonight's Games (half width)
- Each game: away team logo + abbrev @ home team logo + abbrev, game time
- Below games: "N of your players in action"
- "View all games →" links to `/games`

### 5. Roster Alerts (half width)
- Injured players: OUT/DTD badge + team logo + name + injury description
- Eliminated players: ELIM badge + dimmed + strikethrough + "TEAM eliminated"
- Only shows players on user's roster

### 6. Teams Eliminated (half width)
- Grid of eliminated team logos (dimmed, strikethrough abbrev beneath)
- Count: "N of 16 playoff teams eliminated"
- Data from `/api/playoff-bracket` (same `fetchActivePlayoffTeams` logic)

### 7. Quick Actions (full width)
- 4 buttons: My Team, Standings, Rankings, Bracket
- My Team button filled green (primary), others outlined
- Each links to the appropriate page

### Pre-Draft State (setup / inviting / in_progress)

When no complete draft exists, show contextual draft cards instead of the command center.

**Admin view per draft card:**
- Draft name + status badge (color-coded: setup=muted, inviting=gold, in_progress=green)
- Date, time, season type, players per team
- Stats row: joined count, pending invites, paid ratio, entry fee
- Participant list with paid/unpaid status per team
- Action buttons vary by status:
  - **setup/inviting**: "Manage Draft" (primary green → `/dashboard/drafts/[id]`), "Invite Players" (outlined), "Start Draft" (muted)
  - **in_progress**: "Live Draft" (primary green → `/draft/[id]/coach`), "My Team" (outlined → `/draft/[id]/team`)
- Delete draft option (✕ button)

**Non-admin (joined) view per draft card:**
- Draft name + status badge
- "Your Team" box: team name + paid status
- Stats: joined count, players per team, entry fee
- Location + payment info
- Action buttons vary by status:
  - **setup/inviting**: "Waiting for admin to start the draft" message
  - **in_progress**: "My Team" (primary green → `/draft/[id]/team`)

**No "Prepare for your draft" section** — Rankings, Bracket, and Games are already in the navigation bar.

### Unauthenticated State
Unchanged — hero with logo, tagline, sign in/sign up buttons.

## Data Sources

All data already exists in the system:

| Widget | Source |
|--------|--------|
| Draft status + rank | `GET /api/drafts` → picks draft with status `complete` |
| My Team | `draft_picks` + `players` tables via Supabase |
| Standings | `GET /api/drafts/[id]/standings` |
| Yesterday's scores | `player_scores` table filtered by yesterday's date |
| Tonight's games | `fetchTonightGames()` from `nhl-api.ts` |
| Injuries | `GET /api/live-injuries` (ESPN) |
| Eliminated teams | `GET /api/playoff-bracket` + `fetchActivePlayoffTeams()` |
| Player details | `players` table |

### New API: `/api/dashboard`

A single endpoint that aggregates all dashboard data in one call to avoid 6+ parallel fetches on page load:

```typescript
GET /api/dashboard

Response:
{
  draft: { id, name, status, season_type, scoring_format } | null,
  rank: number | null,
  totalTeams: number | null,
  totalPoints: number | null,
  yesterdayPoints: number | null,
  roster: Array<{
    playerId, playerName, team, position,
    totalPoints, yesterdayPoints,
    injuryStatus, injuryDescription, isEliminated
  }>,
  standings: Array<{ teamName, totalPoints }>,  // top 5
  tonightGames: Array<{ away, home, time }>,
  activePlayerCount: number,  // how many rostered players play tonight
  eliminatedTeams: string[],  // team abbrevs
  totalPlayoffTeams: number
}
```

This endpoint:
1. Finds the user's most recent `complete` draft
2. Gets their participant ID and roster
3. Fetches scores, standings snapshot, tonight's games, injuries, elimination data
4. Returns everything in one response

If no complete draft exists, returns `{ draft: null }` and the page falls back to the draft list UI.

**Multiple complete drafts:** The API returns the most recently created complete draft. The draft list fallback still shows all drafts so users can access others.

## New `/games` Page

Standalone page showing all tonight's NHL games with fantasy relevance. Uses **Option A layout** (game cards with roster section below).

### Layout (Option A: Game Cards + Roster Section)

Each game is a vertical card:

1. **Matchup section**: Away team logo + abbrev, "@", Home team logo + abbrev, centered. Logos at 48px.
2. **Game time**: "7:00 PM MT" centered below matchup
3. **Divider line**
4. **"Your Players" section**: Lists rostered players for this game with team logo (18px), name, position. One row per player.
5. **Empty state**: If no rostered players in this game, show "No rostered players in this game" in muted text

### Page Header
- Label: "Tonight's Games" (uppercase, muted)
- Date: "May 2, 2026" (large, bold)
- Subtitle: "3 games · 5 of your players in action"
- Back link: "← Dashboard"

### States
- **No games tonight**: "No games scheduled tonight" with empty state graphic
- **Not in a draft / draft not active**: Show all games without the "Your Players" section
- **Not authenticated**: Show all games with logos and times. Add CTA: "Sign in to see your players" with link to `/auth/login`

### Data
- `fetchTonightGames()` for game schedule (public NHL data)
- User's roster: cross-reference `draft_picks` + `players` table, matching player team to game teams
- `GET /api/games` — new endpoint that returns tonight's games + rostered player info per game for authenticated users

### API: `GET /api/games`
```typescript
Response (authenticated):
{
  date: string,
  games: Array<{
    away: string,       // team abbrev
    home: string,
    gameTime: string,   // "7:00 PM MT"
    yourPlayers: Array<{
      playerName: string,
      team: string,     // team abbrev
      position: string
    }>
  }>,
  totalYourPlayers: number
}

Response (unauthenticated):
{
  date: string,
  games: Array<{ away, home, gameTime }>,
  totalYourPlayers: 0
}
```

### Mobile
- Cards stack vertically (same as desktop, just narrower)
- Logos shrink to 36px
- Single column always

## Mobile Considerations

- My Team grid: 2 columns on mobile
- Standings + Tonight's Games: stack vertically
- Roster Alerts + Teams Eliminated: stack vertically
- Quick Actions: 2x2 grid stays the same
- Player cards slightly smaller on mobile

## Files to Modify/Create

### Modify
- `app/src/app/page.tsx` — complete rewrite of authenticated view
- `app/src/app/api/drafts/route.ts` — no changes needed (existing endpoints sufficient)

### Create
- `app/src/app/api/dashboard/route.ts` — new aggregated dashboard API
- `app/src/app/api/games/route.ts` — new tonight's games API
- `app/src/app/games/page.tsx` — new tonight's games page
- `app/src/components/DashboardWidgets.tsx` — extracted widget components (optional, depends on page.tsx size)

### Existing components to reuse
- `TeamLogo` — team logos everywhere
- `InjuryFlag` — injury badges (may need to verify it works for dashboard context)
- `fetchTonightGames`, `fetchEspnInjuries`, `fetchActivePlayoffTeams` from `nhl-api.ts`
