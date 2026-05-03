# Player Status Indicators — Injury & Elimination

**Date:** 2026-05-02  
**Status:** Approved

## Problem

Post-draft standings and roster views show no player health or playoff elimination status. When players get injured or their NHL team is eliminated from the playoffs, there's no visual indication — managers can't tell at a glance which of their rostered players are inactive.

## Solution

Enrich the standings/results API responses with live injury data (from ESPN Injuries API) and playoff elimination status (from NHL playoff bracket API). Display these as visual indicators on all post-draft roster views.

## Architecture: API-Layer Enrichment

When standings/results API endpoints are called:
1. Fetch picks, scores, participants (existing flow)
2. Fetch ESPN injuries: `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries` → returns teams with injured athletes
3. Fetch NHL playoff bracket: `https://api-web.nhle.com/v1/playoff-bracket/2026` → extract active teams
4. Match ESPN injuries to our drafted players by **player name** (case-insensitive)
5. Determine elimination: if player's NHL team is NOT in the active playoff bracket
6. Merge injury + elimination data into each `RosterPlayer`
7. Return enriched response

**Cache:** In-memory cache with short TTL — 10 min for injuries, 30 min for playoff bracket. Resets on server cold start (fine for Vercel serverless).

## Data Sources

### ESPN Injuries API
- **URL:** `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries`
- **Returns:** JSON with teams → injuries → athlete + status + comment
- **Status values:** `"Day-To-Day"`, `"Out"`, `"Injured Reserve"`
- **Mapping to our format:**
  - `"Day-To-Day"` → `"day-to-day"`
  - `"Out"` → `"week-to-week"` (or `"out for playoffs"` if comment implies season-ending)
  - `"Injured Reserve"` → `"out indefinitely"` (or `"out for playoffs"` if season-ending)
- **No Playwright needed** — simple JSON fetch
- **Player matching:** ESPN `athlete.displayName` vs our DB `players.name` (case-insensitive)

### NHL Playoff Bracket API
- **URL:** `https://api-web.nhle.com/v1/playoff-bracket/2026`
- **Returns:** JSON with series → teams (with `abbrev` field)
- **Active teams:** Extract all `topSeedTeam.abbrev` + `bottomSeedTeam.abbrev` from series that have team data (not TBD)
- **Eliminated:** Any team NOT in the active set

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

### New functions in `nhl-api.ts`

**`fetchEspnInjuries(): Promise<Map<string, { status, description }>>`**
- Fetches ESPN injuries API
- Returns map keyed by player display name (lowercase) → `{ status, description }`
- 10-minute in-memory cache

**`fetchActivePlayoffTeams(): Promise<Set<string>>`**
- Fetches NHL playoff bracket
- Returns set of active team abbreviations
- 30-minute in-memory cache
- During regular season: returns empty set → no elimination logic

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

## Key Decisions

- **ESPN Injuries API** for live injury data — no Playwright, simple JSON fetch
- **Player name matching** (case-insensitive) to link ESPN athletes to our drafted players
- **NHL playoff bracket API** for elimination detection
- **Strikethrough only** for eliminated players — no badge or icon
- **Injury badges after position** — keeps name clean, status is secondary info
- **40% opacity dimming** for both OUT injuries and eliminated players
- **Cache TTL 10/30 min** — fresh enough for game-day updates, prevents API hammering
