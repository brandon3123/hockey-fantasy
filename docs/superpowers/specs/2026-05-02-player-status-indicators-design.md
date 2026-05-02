# Player Status Indicators — Injury & Elimination

**Date:** 2026-05-02  
**Status:** Approved

## Problem

Post-draft standings and roster views show no player health or playoff elimination status. When players get injured or their NHL team is eliminated from the playoffs, there's no visual indication — managers can't tell at a glance which of their rostered players are inactive.

## Solution

Enrich the standings/results API responses with live injury data (from NHL API) and playoff elimination status (from NHL playoff bracket). Display these as visual indicators on all post-draft roster views.

## Architecture: API-Layer Enrichment (Approach 1)

When standings/results API endpoints are called:
1. Fetch picks, scores, participants (existing flow)
2. Collect all unique NHL team abbreviations from drafted players
3. Call `fetchPlayerInjuryStatus(teamAbbrevs)` → map of `{ nhlId → injury }`
4. Call `fetchActivePlayoffTeams()` → set of active team abbreviations
5. If regular season (no bracket data): skip elimination check, all `isEliminated = false`
6. Merge injury + elimination data into each `RosterPlayer`
7. Return enriched response

**Cache:** In-memory cache with short TTL — 10 min for injuries, 30 min for playoff bracket. Resets on server cold start (fine for Vercel serverless).

## Data Model

### RosterPlayer (updated)

```typescript
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
  injuryStatus: "healthy" | "day-to-day" | "week-to-week" | "out indefinitely" | "out for playoffs";
  injuryDescription: string | null;
  isEliminated: boolean;
}
```

### New NHL API functions in `nhl-api.ts`

**`fetchPlayerInjuryStatus(teamAbbrevs: string[])`**
- Fetches current injury data for players on the given teams
- Returns `Map<string, { status, description }>` keyed by player name or NHL ID
- 10-minute in-memory cache
- Works for both regular season and playoffs

**`fetchActivePlayoffTeams(): Promise<Set<string>>`**
- Fetches current playoff bracket from NHL API
- Extracts all teams still appearing in any active series
- Returns set of team abbreviations (e.g., `{"EDM", "FLA", "DAL", "CAR"}`)
- 30-minute in-memory cache
- During regular season (no bracket): returns empty set → no elimination logic

## Visual Design

### Injury indicators (existing InjuryFlag badges)
- **DTD** — yellow badge (`#854d0e` bg, `#fbbf24` text)
- **WTW** — orange badge (`#9a3412` bg, `#fb923c` text)
- **OUT** — red badge (`#7f1d1d` bg, `#fca5a5` text) + row dimmed to 40% opacity
- **Healthy** — no badge, full opacity

### Elimination indicators
- Player name gets **thick strikethrough** (`text-decoration: line-through`, `text-decoration-thickness: 2px`, `text-decoration-color: #fca5a5`)
- Text color changes to `#fca5a5`
- Entire row dimmed to 40% opacity
- No badge or icon — strikethrough alone conveys elimination

### Both injured + eliminated
- Strikethrough on name + injury badge after position
- Row dimmed to 40%

### Layout order per row
`[Round#] [TeamLogo] [PlayerName] [Position] [InjuryBadge?]  ....  [Points] [Goals] [Assists] [GP]`

Badges sit **after** the position indicator (C/LW/RW/D).

## Pages Updated

| Page | File | Change |
|------|------|--------|
| **Standings** | `app/src/app/draft/[id]/standings/page.tsx` | Add InjuryFlag badge after position, strikethrough + dim for eliminated |
| **Results** | `app/src/app/draft/[id]/results/page.tsx` | Same treatment in team roster expansion |
| **Tonight's games** | `app/src/app/draft/[id]/standings/page.tsx` | Show injury badge on drafted players in game expansion |

## API Routes Updated

| Route | Change |
|-------|--------|
| `/api/drafts/[id]/standings` | Enrich `RosterPlayer[]` with injury status + elimination |
| `/api/drafts/[id]/results` | Same enrichment |

## Implementation Steps

1. Add `fetchPlayerInjuryStatus()` to `nhl-api.ts` with caching
2. Add `fetchActivePlayoffTeams()` to `nhl-api.ts` with caching
3. Update `RosterPlayer` interface in standings page and API route
4. Enrich standings API response with injury + elimination data
5. Enrich results API response with injury + elimination data
6. Update standings page roster rows: InjuryFlag badges after position, strikethrough + dim for eliminated
7. Update results page roster rows: same visual treatment
8. Update tonight's game expansion: injury badges on drafted players

## Key Decisions

- **Live NHL API fetch** over static data — always current, no DB migration needed
- **Strikethrough only** for eliminated players — no badge or icon
- **Injury badges after position** — keeps name clean, status is secondary info
- **40% opacity dimming** for both OUT injuries and eliminated players — consistent "inactive" visual language
- **Cache TTL 10/30 min** — fresh enough for game-day updates, prevents API hammering
