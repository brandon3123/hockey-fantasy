# Regular Season Draft Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live draft work for both regular season and playoff pools by computing both projection types, auto-downloading data, and having the frontend display the right stats based on draft season_type.

**Architecture:** Scraper fetches all 32 teams, computes both `projected_points` (PPG × games_remaining) and `projected_playoff_points` (PPG × expected_playoff_games). Frontend uses `useDraftState` to enrich players with `displayPoints`/`displayGames` based on the draft's `season_type`. Components swap `projectedPlayoffPoints` for `displayPoints` everywhere. Injured players are shown but unpickable.

**Tech Stack:** Python scraper, Supabase/PostgreSQL, Next.js/React/TypeScript

---

### Task 1: Auto-download MoneyPuck CSVs with fallback

**Files:**
- Modify: `scraper/scrape_moneypuck.py`

Add a `download_csv_with_fallback(filename, url, local_dir)` helper. It tries to download from the URL, saves to the local dir, falls back to existing local file with a warning, or prompts the user if neither works.

- [ ] **Step 1: Add download helper at the top of `scrape_moneypuck.py`**

After the existing imports, add:

```python
import urllib.request
import sys


MONEYPUCK_BASE_URL = "https://moneypuck.com"
MONEYPUCK_LOCAL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "moneypuck")

MONEYPUCK_FILES = {
    "simulations_recent.csv": f"{MONEYPUCK_BASE_URL}/simulations_recent.csv",
    "lines.csv": f"{MONEYPUCK_BASE_URL}/lines.csv",
    "rankings_current.csv": f"{MONEYPUCK_BASE_URL}/rankings_current.csv",
}


def download_csv_with_fallback(filename: str, url: str, local_dir: str) -> str:
    local_path = os.path.join(local_dir, filename)
    downloaded = False

    try:
        print(f"  Downloading {filename} from {url}...")
        os.makedirs(local_dir, exist_ok=True)
        urllib.request.urlretrieve(url, local_path)
        downloaded = True
        print(f"  ✓ Downloaded {filename}")
    except Exception as e:
        print(f"  ✗ Download failed: {e}")

    if not downloaded:
        if os.path.exists(local_path):
            print(f"  ⚠ Using existing local file: {local_path}")
        else:
            response = input(f"  Auto-download of {filename} failed and no local file found. Continue? (y/n): ").strip().lower()
            if response != 'y':
                print("  Aborting.")
                sys.exit(1)

    return local_path


def download_all_moneypuck_files():
    print("Downloading MoneyPuck data files...")
    paths = {}
    for filename, url in MONEYPUCK_FILES.items():
        paths[filename] = download_csv_with_fallback(filename, url, MONEYPUCK_LOCAL_DIR)
    print()
    return paths
```

- [ ] **Step 2: Update `scrape_moneypuck_team_odds()` to use downloaded file**

Replace the function body to accept an explicit path parameter instead of using the module-level `_MONEYPUCK_CSV_PATH`:

```python
def scrape_moneypuck_team_odds(csv_path: str = None) -> Dict[str, Dict[str, float]]:
    if csv_path is None:
        csv_path = _get_moneypuck_path()

    print("Loading team odds from MoneyPuck CSV...")
    team_odds = {}

    try:
        with open(csv_path, 'r') as f:
```

The rest of the function stays the same, including the `if round1 < 0.01: continue` filter (this correctly excludes non-playoff teams from having odds).

- [ ] **Step 3: Update `parse_lines_csv()` to accept explicit path**

```python
def parse_lines_csv(csv_path: str = None) -> List[Dict]:
    if csv_path is None:
        csv_path = _get_moneypuck_path().replace('simulations_recent.csv', 'lines.csv')
```

Rest of function unchanged.

- [ ] **Step 4: Update `parse_rankings_csv()` to accept explicit path**

```python
def parse_rankings_csv(csv_path: str = None) -> List[Dict]:
    if csv_path is None:
        csv_path = _get_moneypuck_path().replace('simulations_recent.csv', 'rankings_current.csv')
```

Rest of function unchanged.

- [ ] **Step 5: Verify scraper still runs**

Run: `cd scraper && python -c "from scrape_moneypuck import download_all_moneypuck_files; download_all_moneypuck_files()"`

Expected: Downloads 3 CSVs (or falls back to local), prints success messages.

- [ ] **Step 6: Commit**

```bash
git add scraper/scrape_moneypuck.py
git commit -m "Add auto-download for MoneyPuck CSVs with local fallback and user prompt"
```

---

### Task 2: Update combine.py for all 32 teams + both projections

**Files:**
- Modify: `scraper/combine.py`

- [ ] **Step 1: Remove playoff team filter and injury filter**

In `combine_data()`, remove these lines:

```python
from scrape_rosters import PLAYOFF_TEAMS_2026

playoff_rosters = [p for p in rosters if p['team'] in PLAYOFF_TEAMS_2026]
print(f"    Found {len(rosters)} total players, {len(playoff_rosters)} from playoff teams")
```

Replace with:
```python
print(f"    Found {len(rosters)} total players from all teams")
```

Remove the injury filter:
```python
rosters = [p for p in playoff_rosters if p['injury']['status'] != 'out for playoffs']
print(f"    Found {len(rosters)} eligible players after injury filter")
```

Change the merge loop to iterate `rosters` (not `playoff_rosters`):
```python
for roster_player in rosters:
```

- [ ] **Step 2: Call `download_all_moneypuck_files()` and pass paths to MoneyPuck functions**

Replace the MoneyPuck loading section:

```python
from scrape_moneypuck import scrape_moneypuck_team_odds, scrape_player_stats, generate_stats_for_player, parse_lines_csv, parse_rankings_csv, download_all_moneypuck_files

moneypuck_paths = download_all_moneypuck_files()

print("  - Fetching team advancement odds from MoneyPuck...")
team_odds = scrape_moneypuck_team_odds(moneypuck_paths.get('simulations_recent.csv'))
print(f"    Found odds for {len(team_odds)} teams")

print("  - Fetching player stats...")
player_stats = scrape_player_stats()
print(f"    Found stats for {len(player_stats)} players")

print("  - Loading ROS from FantasyPros (Rest of Season)...")
ros_data = load_fantasypros_ros()
print(f"    Found {len(ros_data)} players with ROS data")

print("  - Loading MoneyPuck lines data...")
lines_data = parse_lines_csv(moneypuck_paths.get('lines.csv'))
print(f"    Found {len(lines_data)} line combinations")

print("  - Loading MoneyPuck rankings data...")
rankings_data = parse_rankings_csv(moneypuck_paths.get('rankings_current.csv'))
print(f"    Found {len(rankings_data)} team rankings")
```

- [ ] **Step 3: Compute both projections for every player**

Replace the odds fallback and projection calculation:

```python
odds = team_odds.get(team, None)

if isinstance(stats, dict) and 'pointsPerGame' in stats:
    ppg = stats.get('pointsPerGame', 0.0)
    goals = stats.get('regularSeasonGoals', 0)
    assists = stats.get('regularSeasonAssists', 0)
    games = stats.get('gamesPlayed', 0)
    last10 = stats.get('last10Games')
    last20 = stats.get('last20Games')
else:
    ppg = stats.get('ppg', 0.0)
    goals = stats.get('goals', 0)
    assists = stats.get('assists', 0)
    games = stats.get('games', 0)
    last10 = None
    last20 = None

games_remaining = max(0, 82 - games)
projected_points = round(ppg * games_remaining, 1)

if odds:
    projected_playoff_games = calculate_projected_playoff_games(odds)
    projected_playoff_points = round(ppg * projected_playoff_games, 1)
else:
    projected_playoff_games = 0
    projected_playoff_points = 0
```

- [ ] **Step 4: Update player dict with new fields**

```python
player = {
    'name': name,
    'team': team,
    'position': position,
    'regularSeasonGoals': goals,
    'regularSeasonAssists': assists,
    'gamesPlayed': games,
    'pointsPerGame': round(ppg, 2),
    'last10Games': last10,
    'last20Games': last20,
    'gamesRemaining': games_remaining,
    'projectedPoints': projected_points,
    'teamAdvancementOdds': {
        'round1': round(odds['round1'], 2),
        'round2': round(odds['round2'], 2),
        'round3': round(odds['round3'], 2),
        'round4': round(odds['round4'], 2),
    } if odds else None,
    'projectedPlayoffGames': round(projected_playoff_games, 1),
    'projectedPlayoffPoints': projected_playoff_points,
    'adp': round(ros_rank, 1) if ros_rank else None,
    'injury': roster_player['injury'],
}
```

- [ ] **Step 5: Verify scraper produces output**

Run: `cd scraper && python run.py`

Expected: Downloads MoneyPuck CSVs (or falls back), fetches all 32 team rosters, produces `players.json` with both `projectedPoints` and `projectedPlayoffPoints` fields. Players on non-playoff teams should have `projectedPlayoffPoints: 0` and `teamAdvancementOdds: null`.

- [ ] **Step 6: Commit**

```bash
git add scraper/combine.py scraper/run.py
git commit -m "Scraper: fetch all 32 teams, compute both regular season and playoff projections"
```

---

### Task 3: Database migration + import script

**Files:**
- Create: `supabase/migrations/003_regular_season_columns.sql`
- Modify: `app/scripts/import-players.ts`

- [ ] **Step 1: Create migration**

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS games_remaining INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS projected_points NUMERIC(6,2) DEFAULT 0;
```

- [ ] **Step 2: Update import script — add new fields to PlayerJSON interface**

In `app/scripts/import-players.ts`, add to the `PlayerJSON` interface:

```typescript
gamesRemaining: number;
projectedPoints: number;
```

- [ ] **Step 3: Update import script — add new columns to row mapping**

In the row mapping object, add:

```typescript
games_remaining: p.gamesRemaining,
projected_points: p.projectedPoints,
```

- [ ] **Step 4: Run migration in Supabase Dashboard**

The user must run `003_regular_season_columns.sql` manually in the Supabase SQL editor.

- [ ] **Step 5: Re-import players**

Run: `cd app && npx tsx scripts/import-players.ts`

Expected: Players upserted with `games_remaining` and `projected_points` values.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/003_regular_season_columns.sql app/scripts/import-players.ts
git commit -m "Add games_remaining and projected_points columns to players table"
```

---

### Task 4: Update Player type + useDraftState enrichment

**Files:**
- Modify: `app/src/types/player.ts`
- Modify: `app/src/hooks/useDraftState.ts`

- [ ] **Step 1: Add new fields to Player type**

In `app/src/types/player.ts`, add after `projectedPlayoffPoints`:

```typescript
gamesRemaining: number
projectedPoints: number
displayPoints?: number
displayGames?: number
```

- [ ] **Step 2: Update useDraftState — add new columns to PlayerRow interface**

In `app/src/hooks/useDraftState.ts`, add to `PlayerRow`:

```typescript
games_remaining: number
projected_points: number
```

- [ ] **Step 3: Update mapPlayerRow — map new columns**

Add to the returned object:

```typescript
gamesRemaining: row.games_remaining ?? 0,
projectedPoints: row.projected_points ?? 0,
```

- [ ] **Step 4: Add enrichment logic after availablePlayers computation**

Replace the `availablePlayers` and return sections:

```typescript
const seasonType = draft?.season_type ?? 'playoffs'

const enrichedPlayers = useMemo(() => {
  return players.map(p => ({
    ...p,
    displayPoints: seasonType === 'playoffs'
      ? (p.projectedPlayoffPoints || p.projectedPoints || 0)
      : (p.projectedPoints || 0),
    displayGames: seasonType === 'playoffs'
      ? (p.projectedPlayoffGames || 0)
      : (p.gamesRemaining || 0),
  }))
}, [players, seasonType])

const playoffTeamPlayers = useMemo(() => {
  if (seasonType !== 'playoffs') return enrichedPlayers
  return enrichedPlayers.filter(p => (p.teamAdvancementOdds?.round1 ?? 0) > 0)
}, [enrichedPlayers, seasonType])

const pickedPlayerSlugs = new Set(
  picks.map(p => p.player_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
)
const allPlayers = playoffTeamPlayers
const availablePlayers = allPlayers.filter(
  p => !pickedPlayerSlugs.has(p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
)
```

- [ ] **Step 5: Update return object**

The hook already returns `players` and `availablePlayers`. Now `players` should be `enrichedPlayers` (with `displayPoints`/`displayGames`), and `availablePlayers` is the filtered set. Update the return:

```typescript
return {
  draft,
  participants,
  picks,
  players: enrichedPlayers,
  availablePlayers,
  ...
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add app/src/types/player.ts app/src/hooks/useDraftState.ts
git commit -m "Add displayPoints/displayGames enrichment based on draft season_type"
```

---

### Task 5: Switch components from projectedPlayoffPoints to displayPoints

**Files:**
- Modify: `app/src/components/FullPlayerList.tsx`
- Modify: `app/src/components/LivePlayerSidebar.tsx`
- Modify: `app/src/components/TeamBrowserTab.tsx`
- Modify: `app/src/components/MyTeamTab.tsx`
- Modify: `app/src/components/DraftGrid.tsx`
- Modify: `app/src/components/DraftCoach.tsx`
- Modify: `app/src/components/BestAvailable.tsx`
- Modify: `app/src/components/PositionTracker.tsx`
- Modify: `app/src/components/PlayerTable.tsx`
- Modify: `app/src/components/TeamStackPanel.tsx`
- Modify: `app/src/components/TeamCompositionVisualizer.tsx`

This is a systematic find-and-replace. In every file:

- Replace `projectedPlayoffPoints` with `displayPoints`
- Replace `projectedPlayoffGames` with `displayGames`

For `PlayerTable.tsx`, also update the `SortField` type to use `'displayPoints'` instead of `'projectedPlayoffPoints'`.

- [ ] **Step 1: Replace all occurrences**

Each file needs these replacements:

| Component File | Lines to change |
|----------------|----------------|
| `FullPlayerList.tsx` | `projectedPlayoffPoints` → `displayPoints` (sort + display), `projectedPlayoffGames` → `displayGames` (display) |
| `LivePlayerSidebar.tsx` | `projectedPlayoffPoints` → `displayPoints`, `projectedPlayoffGames` → `displayGames` |
| `TeamBrowserTab.tsx` | `projectedPlayoffPoints` → `displayPoints` (sort + display) |
| `MyTeamTab.tsx` | `projectedPlayoffPoints` → `displayPoints` (sum + display) |
| `DraftGrid.tsx` | `projectedPlayoffPoints` → `displayPoints` (sum + display + sort), `projectedPlayoffGames` → `displayGames` |
| `DraftCoach.tsx` | `projectedPlayoffPoints` → `displayPoints` (display + scoring) |
| `BestAvailable.tsx` | `projectedPlayoffPoints` → `displayPoints` (sort + display), `projectedPlayoffGames` → `displayGames` |
| `PositionTracker.tsx` | `projectedPlayoffPoints` → `displayPoints` |
| `PlayerTable.tsx` | `SortField` type + display: `projectedPlayoffPoints` → `displayPoints` |
| `TeamStackPanel.tsx` | `projectedPlayoffPoints` → `displayPoints` (sort + display) |
| `TeamCompositionVisualizer.tsx` | `projectedPlayoffPoints` → `displayPoints` (sum), `projectedPlayoffGames` → `displayGames` (sum) |

- [ ] **Step 2: Update lib files**

Same replacements in:
- `app/src/lib/draft-coach.ts` — `projectedPlayoffPoints` → `displayPoints` (scoring + labels)
- `app/src/lib/utils.ts` — `projectedPlayoffPoints` → `displayPoints` (sort)
- `app/src/lib/draft-logic.ts` — `projectedPlayoffPoints` → `displayPoints` (sort)

- [ ] **Step 3: Update page files**

Same replacements in:
- `app/src/app/draft/[id]/live/page.tsx` — `projectedPlayoffPoints` → `displayPoints` (display + sum), `projectedPlayoffGames` → `displayGames`
- `app/src/app/draft/[id]/coach/page.tsx` — `projectedPlayoffPoints` → `displayPoints` (sum)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

Expected: No errors. Any remaining `projectedPlayoffPoints` reference in page files should now only be in the type definition, not in component logic.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ app/src/lib/ app/src/app/draft/
git commit -m "Switch all components from projectedPlayoffPoints to displayPoints/displayGames"
```

---

### Task 6: Make injured players unpickable

**Files:**
- Modify: `app/src/components/InjuryFlag.tsx`
- Modify: `app/src/components/FullPlayerList.tsx`
- Modify: `app/src/components/LivePlayerSidebar.tsx`
- Modify: `app/src/components/BestAvailable.tsx`
- Modify: `app/src/components/TeamBrowserTab.tsx`
- Modify: `app/src/components/TeamStackPanel.tsx`

- [ ] **Step 1: Add `isPlayerPickable` helper**

In `app/src/components/InjuryFlag.tsx`, export a helper function:

```typescript
export function isPlayerPickable(player: { injuryStatus: string }): boolean {
  const status = player.injuryStatus.toLowerCase()
  return status === 'healthy' || status === 'day-to-day' || status === 'week-to-week'
}
```

- [ ] **Step 2: Update all player-clickable components to use `isPlayerPickable`**

In each component that has an `onClick` handler for drafting a player, add a guard:

```typescript
import { isPlayerPickable } from './InjuryFlag'

// In the click handler:
onClick={() => {
  if (!isPlayerPickable(player)) return
  onDraftPlayer(player)
}}

// On the row/container element:
className={`... ${!isPlayerPickable(player) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
```

Affected components (already have `isDraftComplete` guards — add alongside):
- `FullPlayerList.tsx` — player row click
- `LivePlayerSidebar.tsx` — player item click
- `BestAvailable.tsx` — top 3 and best healthy clicks
- `TeamBrowserTab.tsx` — available player clicks
- `TeamStackPanel.tsx` — player clicks

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/src/components/InjuryFlag.tsx app/src/components/FullPlayerList.tsx app/src/components/LivePlayerSidebar.tsx app/src/components/BestAvailable.tsx app/src/components/TeamBrowserTab.tsx app/src/components/TeamStackPanel.tsx
git commit -m "Make injured players visible but unpickable in draft"
```

---

### Task 7: Update remaining page files and rosters

**Files:**
- Modify: `app/src/app/page.tsx`
- Modify: `app/src/app/rosters/page.tsx`
- Modify: `app/src/app/draft/page.tsx`

These are non-live-draft pages that also reference `projectedPlayoffPoints`. Update them to use `displayPoints` where appropriate. Since these pages don't have a draft context (no `season_type`), they should use `projectedPoints` as the default display (regular season is the safe default year-round).

- [ ] **Step 1: Update `app/src/app/page.tsx`**

In the PlayerRow interface and mapping, add `projectedPoints` mapping and use it for display:

```typescript
projectedPoints: row.projected_points ?? row.projected_playoff_points ?? 0,
```

Display `projectedPoints` instead of `projectedPlayoffPoints`.

- [ ] **Step 2: Update `app/src/app/rosters/page.tsx`**

Replace all `projectedPlayoffPoints` references with `projectedPoints` for display.

- [ ] **Step 3: Update `app/src/app/draft/page.tsx`**

Replace `projectedPlayoffPoints` references with `projectedPoints` for the legacy draft page.

- [ ] **Step 4: Verify TypeScript compiles and build passes**

Run: `cd app && npx tsc --noEmit && npm run build`

Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/page.tsx app/src/app/rosters/page.tsx app/src/app/draft/page.tsx
git commit -m "Update legacy pages to use projectedPoints instead of playoff-specific field"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 2: Run build**

Run: `cd app && npm run build`

- [ ] **Step 3: Verify no remaining `projectedPlayoffPoints` in component display logic**

Run: `cd app && grep -r "projectedPlayoffPoints" src/components/ src/lib/ src/app/draft/`

Expected: Only the type definition in `types/player.ts` should reference it. All components should use `displayPoints`.

- [ ] **Step 4: Push**

```bash
git push origin master
```
