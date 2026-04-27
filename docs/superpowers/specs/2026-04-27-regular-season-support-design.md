# Regular Season Draft Support — Design Spec

## Problem

The live draft only works for playoff pools. The scraper hardcodes 16 playoff teams, all player rankings use `projected_playoff_points`, and no code branches on `draft.season_type`. A regular season draft would show playoff-projected values and miss 16 teams' worth of players.

## Solution

Make the scraper fetch all 32 teams, compute both regular season and playoff projections for every player, and have the frontend pick the right projection based on the draft's `season_type`. Auto-download MoneyPuck CSVs with local fallback.

## Scraper Changes

### Auto-download MoneyPuck CSVs

Replace local file reads with download-then-fallback:

| File | URL | Fallback |
|------|-----|----------|
| `simulations_recent.csv` | `https://moneypuck.com/simulations_recent.csv` | Local `moneypuck/simulations_recent.csv` |
| `lines.csv` | `https://moneypuck.com/lines.csv` | Local `moneypuck/lines.csv` |
| `rankings_current.csv` | `https://moneypuck.com/rankings_current.csv` | Local `moneypuck/rankings_current.csv` |
| `fantasy-pros/ros.csv` | No URL — manual | Local `fantasy-pros/ros.csv` (required) |

Logic per file:
1. Try download from URL → save to local path
2. If download fails AND local file exists → print warning, use local file
3. If download fails AND no local file → print error, exit

FantasyPros ROS CSV is manual-only. Error if missing.

### Remove hardcoded playoff team filter

**Before:** `combine.py` imports `PLAYOFF_TEAMS_2026` and filters rosters to 16 teams.

**After:** `combine.py` fetches all 32 team rosters from NHL API. No team filtering at the scraper level. The playoff/non-playoff distinction comes from the data itself — MoneyPuck advancement odds are only populated for playoff teams.

### Compute both projections

For every player:

```
games_remaining = 82 - games_played
projected_points = points_per_game * games_remaining          # regular season
projected_playoff_points = points_per_game * expected_playoff_games  # only if team has advancement odds
```

- `projected_points` is always populated for all players
- `projected_playoff_points` is only populated for players on teams with `team_advancement_r1 > 0`
- `games_remaining` is stored as a new field

### Ranking

Sort by `projected_playoff_points` descending for the `rank` column. Players without playoff projection get ranked last (they're irrelevant for playoff drafts). Regular season drafts will use the ROS rank or `projected_points` for ordering instead.

### Injury filter

Remove the "out for playoffs" filter at the scraper level. Instead, store the injury status and let the frontend decide:
- Regular season: show all players regardless of injury (they could return during the season)
- Playoffs: filter out "out for playoffs" players in the frontend based on `season_type`

## Database Schema

Add two columns to `players`:

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS games_remaining INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS projected_points NUMERIC(6,2) DEFAULT 0;
```

Existing playoff columns (`projected_playoff_points`, `team_advancement_r1`-`r4`, `projected_playoff_games`) remain unchanged. They'll be null/0 for non-playoff teams during the regular season.

Update the import script (`scripts/import-players.ts`) to handle the new columns.

## Frontend Changes

### useDraftState resolves the right projection

Instead of every component branching on `season_type`, `useDraftState` enriches each player with a unified `displayPoints` field:

```typescript
const seasonType = draft?.season_type ?? 'playoffs'

const enrichedPlayers = players.map(p => ({
  ...p,
  displayPoints: seasonType === 'playoffs'
    ? (p.projectedPlayoffPoints ?? p.projectedPoints ?? 0)
    : (p.projectedPoints ?? 0)
}))
```

Player pool filtering:
- **Regular season draft**: all players
- **Playoff draft**: only players where `team_advancement_r1 > 0` (teams with playoff odds)

### Component changes

All components currently referencing `player.projectedPlayoffPoints` switch to `player.displayPoints`:

| Component | File | Change |
|-----------|------|--------|
| FullPlayerList | `FullPlayerList.tsx` | Sort/display `displayPoints` |
| BestAvailable | `BestAvailable.tsx` | Display `displayPoints` |
| LivePlayerSidebar | `LivePlayerSidebar.tsx` | Display `displayPoints` |
| DraftGrid | `DraftGrid.tsx` | Sum `displayPoints` for PTS column |
| TeamBrowserTab | `TeamBrowserTab.tsx` | Sort by `displayPoints`, show advancement odds only when present |
| MyTeamTab | `MyTeamTab.tsx` | Sum `displayPoints` for total |
| DraftCoach | `DraftCoach.tsx` | Use `displayPoints` for talent score |
| MiniDraftBoard (live, coach, team) | 3 page files | Sum `displayPoints` for PTS column |
| PositionTracker | `PositionTracker.tsx` | Use `displayPoints` per pick |
| PlayerTable | `PlayerTable.tsx` | Display `displayPoints` |

The `TeamBrowserTab` R1-R4 advancement odds badges already handle null gracefully — they just won't render during regular season when odds are null.

### Player type update

Add new fields to the `Player` type in `types/player.ts`:

```typescript
gamesRemaining: number
projectedPoints: number
displayPoints?: number  // computed by useDraftState based on season_type
```

### Column headers

Player list column headers stay as "Proj Pts" for both modes. The "Proj GP" column:
- Playoff draft: shows `projectedPlayoffGames`
- Regular season: shows `gamesRemaining`

This is handled the same way — `useDraftState` adds a `displayGames` field.

## Data Flow Summary

```
scraper/run.py
  ├── Download MoneyPuck CSVs (3 files) with local fallback
  ├── Check FantasyPros ROS CSV exists (manual, error if missing)
  ├── Fetch all 32 team rosters from NHL API
  ├── Fetch injury data from ESPN
  ├── Compute:
  │   ├── projected_points = PPG × (82 - GP)        [all players]
  │   ├── projected_playoff_points = PPG × playoff_games  [playoff teams only]
  │   └── games_remaining = 82 - GP                  [all players]
  └── Output → players.json → import-players.ts → Supabase

Frontend:
  useDraftState
    ├── Reads draft.season_type
    ├── Filters players (playoff draft → only teams with advancement odds)
    ├── Enriches each player with displayPoints + displayGames
    └── All components use displayPoints/displayGames
```

## Out of Scope

- Auto-scraping FantasyPros (blocked by anti-bot, manual CSV is fine)
- Schedule-strength or back-to-back adjustments
- Regression-to-mean for small samples
- Goalie support (separate concern)
