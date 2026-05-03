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

### No Active Draft State
If user has no complete drafts (only setup/inviting/in_progress), show the existing draft list UI with status badges. The command center only renders for drafts in `complete` status with scoring data.

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

A standalone page showing all tonight's NHL games with fantasy relevance.

### Layout
- Header: "Tonight's Games" with date
- For each game: matchup with team logos, game time/TV
- Below each game: list of **your rostered players** in that game (with team logo, name, position)
- If no games tonight: "No games tonight" message
- If not in a draft or draft not active: show all games without player highlights
- If not authenticated: show all games with team logos and times, no player highlights. Add a CTA to sign in.

### Data
- `fetchTonightGames()` for game schedule
- User's roster from the dashboard API or `/api/drafts/[id]`
- Cross-reference: which of user's players are on teams playing tonight

### API
- Authenticated: `GET /api/dashboard` (reuses the same endpoint, returns `tonightGames` with `activePlayerCount`)
- Unauthenticated: `GET /api/tonight-games` (new lightweight endpoint, or reuse existing `fetchTonightGames` client-side since it's public NHL data)

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
- `app/src/app/games/page.tsx` — new tonight's games page
- `app/src/components/DashboardWidgets.tsx` — extracted widget components (optional, depends on page.tsx size)

### Existing components to reuse
- `TeamLogo` — team logos everywhere
- `InjuryFlag` — injury badges (may need to verify it works for dashboard context)
- `fetchTonightGames`, `fetchEspnInjuries`, `fetchActivePlayoffTeams` from `nhl-api.ts`
