# Scraper Season/Mode Configuration + Preseason Regular-Season Support

**Date:** 2026-09-25
**Status:** Approved (design phase)

## Context

The site owner is participating in an **external draft** (run by someone else) for the
**2026-27 NHL regular season**, tracked with the standalone external draft board
(`app/src/app/draft/page.tsx`, "External Draft → Draft Board" in Navigation).

Two problems were found:

1. **Crash (fixed 2026-09-25):** the external board passed raw `players.json` to
   shared draft components that require runtime-enriched `displayPoints`/`displayGames`
   (`TypeError: Cannot read properties of undefined (reading 'toFixed')` at
   `DraftCoach.tsx:224`). Fixed via `enrichDisplayFields()` in `app/src/lib/utils.ts`,
   applied at the two raw-JSON load sites (external board, rankings Supabase fallback).
   This design **amends** that enrichment (see Frontend section).

2. **Scraper gaps:** the scraper is playoff-oriented and pinned to the completed
   2025-26 season:
   - `scraper/scrape_rosters.py:13` — `CURRENT_SEASON = "20252026"` hardcoded
   - `scraper/scrape_nhl_api.py:107,206` — season defaults hardcoded to `"20252026"`
   - `combine.py:62-67` — playoff-team detection + odds zeroing runs unconditionally
   - `combine.py:182` — ranks all players by `projectedPlayoffPoints`
   - `combine.py:141-142` — `projected_points = ppg × (82 − GP)` is rest-of-season math;
     with 0 games played everyone projects to 0, and players missing from stats leaders
     get **random synthetic stats** (`scrape_moneypuck.py:199`)
   - No 2026-27 preseason projection source is wired in
     (`scrape_fantasypros.py:66-77` regular-season fallback is unimplemented;
     `fantasy-pros/ros.csv` is a stale manual file from April 2026)

## Goals

- Scraper runs for any season, chosen at runtime (interactive prompt, existing pattern)
- Explicit **regular vs playoffs** mode, chosen at runtime (default: regular)
- Regular preseason (0 games played) produces a **draft-usable** `players.json`:
  all 32 teams, real per-player point projections, ranked by regular-season value
- External draft board displays **projections while no games are played**, actual
  points-to-date once the season runs

## Non-Goals

- No changes to playoffs-mode ranking/zeroing behavior (beyond season threading)
- No Yahoo OAuth ADP / FreshSheets integration (existing unused scripts stay as-is)
- No automated Supabase import (`app/scripts/import-players.ts` stays manual/optional)
- No UI changes beyond the `enrichDisplayFields` amendment

## Design

### 1. CLI — `scraper/combine.py`

Two interactive prompts at start of `combine_data()`:

1. Season year — "Enter season year (e.g. 2026):" (default `2026`).
   Start year → NHL season code via pure helper `nhl_season_code(start_year) -> str`
   (`2026` → `"20262027"`). MoneyPuck downloads keep using the start year
   (`seasonSummary/2026`), as today.
2. Mode — "Draft mode: (r)egular or (p)layoffs?:" (default **regular**).

Both values thread through the pipeline described below. `run.py` is unchanged.

### 2. Rosters — `scraper/scrape_rosters.py`

- `scrape_playoff_rosters()` → **`scrape_rosters(season: str, mode: str)`**;
  `combine.py` import updated. The module-level `CURRENT_SEASON` constant is removed;
  the NHL roster URL uses the passed season (`/v1/roster/{team}/{season}`).
- **regular:** use all 32 teams (`ALL_TEAMS`) directly — no standings call, no
  clinch-indicator detection.
- **playoffs:** current behavior — `get_playoff_teams()` detection, all-teams fallback.
- Per-team roster failures: warn and skip (existing pattern).

### 3. NHL API stats — `scraper/scrape_nhl_api.py` + `combine.py`

- `scrape_all_player_stats(season)` already parameterized: `combine.py` passes the
  active season. `scrape_player_game_log(player_id, season)` and
  `generate_stats_for_player(...)` stop relying on hardcoded `"20252026"` defaults —
  callers pass the active season through.
- **Preseason detection:** after fetching stats for the target season, if the stats
  dict is empty, set `is_preseason = True` for the merge step. (NHL stats leaders
  return nothing before a season starts.)

### 4. New: `scraper/scrape_fantasypros_preseason.py`

Scrapes FantasyPros NHL preseason projections (projected points per player) for the
upcoming season, using requests + BeautifulSoup (pattern of `scrape_fantasypros.py`).

- Returns `Dict[player_name -> projected_points]`.
- Robustness: if parsing yields fewer than 50 players (bot block / layout change /
  JS-only rendering), print a warning and return `{}`.
- Pure parsing logic separated from fetching so it can be unit-tested against a
  saved HTML/CSV fixture.

### 5. Mode logic — `scraper/combine.py` merge step

**Regular mode:**
- No playoff-team odds zeroing (MoneyPuck odds kept as-is when available)
- **Rank by `projected_points`** (today: ranks by `projectedPlayoffPoints`)
- `teams.json` gets all 32 teams
- In-season (stats exist): current math — `projected_points = ppg × (82 − GP)`,
  `games_remaining = 82 − GP`
- **Preseason (no stats):**
  - Skip the per-player synthetic-stats fallback (`generate_stats_for_player` is
    **not** called)
  - `regularSeasonGoals`, `regularSeasonAssists`, `gamesPlayed` = 0
  - `projected_points` = FantasyPros preseason projected points; if a player is
    missing from that map (or the scrape returned `{}`), fall back to the player's
    **2025-26 actual points** (`goals + assists` from `scrape_all_player_stats`
    for the previous season code)
  - `games_remaining` = 82; `pointsPerGame = round(projected_points / 82, 2)`
    (keeps the board's ppg column meaningful)
  - `adp` still sourced from the FantasyPros ROS CSV when present (unchanged)

**Playoffs mode:** today's behavior (detection, odds zeroing, rank by
`projectedPlayoffPoints`), with the season threaded through so 2026-27 playoff
drafts fetch the right data.

Playoff projection math (`ppg × expected playoff games` from MoneyPuck odds) runs in
both modes when odds exist — the same `players.json` continues to serve both
`season_type`s (see `useDraftState.ts`).

### 6. Frontend amendment — `app/src/lib/utils.ts` `enrichDisplayFields`

```ts
displayPoints: player.displayPoints ?? (
  player.gamesPlayed > 0
    ? (player.regularSeasonGoals ?? 0) + (player.regularSeasonAssists ?? 0)
    : (player.projectedPoints ?? 0)
),
displayGames: player.displayGames ?? (
  player.gamesPlayed > 0 ? player.gamesPlayed : (player.gamesRemaining ?? 0)
),
```

Projections first while no games are played; actual points-to-date once the season
runs. Known edge: a player with GP=0 mid-season (injured) shows their (stale)
projection — acceptable and documented.

### 7. Testing

**Python (pytest, added to `scraper/requirements.txt` if absent):**
- `nhl_season_code(2026)` → `"20262027"`
- Preseason projection math: FantasyPros value used; missing player → previous-season
  G+A fallback; `ppg = projected/82`; zeroed G+A/GP
- Mode ranking: regular ranks by `projected_points`, playoffs by
  `projected_playoff_points`
- FantasyPros preseason parser against a fixture (valid table → dict; empty/failed
  page → `{}`)
- Synthetic-stats fallback is skipped when preseason is detected
- All tests run against pure functions — no network in unit tests (scrape functions
  stay thin I/O wrappers)

**Frontend:** extend the 2026-09-25 one-off regression test with the new precedence:
raw player with `gamesPlayed > 0` → actuals; `gamesPlayed == 0` + projections →
projections; already-enriched player passes through unchanged.

**Manual E2E:** run the scraper in regular mode for 2026; verify `players.json`
(32 teams, no synthetic stats, projections populated, ranked by projected points);
smoke-test the external board at `/draft`.

### 8. Error handling

- FantasyPros preseason scrape fails/short → warn, fall back to last-season actuals
- NHL 2026-27 roster unavailable for a team → warn, skip that team (existing pattern)
- MoneyPuck season files missing → existing local-file fallbacks
- If requests-based FantasyPros scraping proves unusable at implementation time
  (JS-only page), escalate to the existing Playwright setup
  (`scrape_stats_playwright.py` pattern) — data fallback still applies meanwhile

## Data flow (regular preseason run)

```
run.py → combine_data()
  prompt season=2026, mode=regular → season code 20262027
  scrape_rosters("20262027", "regular")        → all 32 teams' skaters
  ESPN injuries                                 → injury status
  MoneyPuck (2026)                              → odds, lines, rankings
  scrape_all_player_stats("20262027")           → {} (preseason)
  scrape_fantasypros_preseason()                → {name → projected pts}
  scrape_all_player_stats("20252026")           → fallback actuals (2025-26)
  merge: GP/G+A = 0, projectedPoints = FP || 2025-26 actuals, ppg = proj/82
  rank by projected_points → players.json (+ lines, rankings, teams.json)
/draft board → enrichDisplayFields → displayPoints = projectedPoints (GP=0)
```
