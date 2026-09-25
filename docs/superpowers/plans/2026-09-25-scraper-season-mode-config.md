# Scraper Season/Mode Configuration + Preseason Regular-Season Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scraper season- and mode-configurable (regular/playoffs) so a pre-season 2026-27 regular-season external draft produces a draft-usable `players.json` (all 32 teams, real projections, ranked by regular-season value), with the external draft board showing projections until games are played.

**Architecture:** Pure helpers (`season_config.py`, `preseason.py`) + a pure merge function (`build_players` in `combine.py`) are TDD'd with pytest; network scrapers stay thin I/O wrappers. `combine_data()` orchestrates: prompts for season + mode, threads the season through rosters/stats, and in preseason regular mode substitutes FantasyPros preseason projections (fallback: previous season's actual points) for rest-of-season math. Frontend: `enrichDisplayFields` shows projected points while `gamesPlayed == 0`, actual points once the season runs, verified by a permanent tsx regression script.

**Tech Stack:** Python 3.14 (`scraper/venv`), requests + BeautifulSoup (lxml), pytest (new), TypeScript/Next.js 15 (`app/`), tsx test runner.

**Spec:** `docs/superpowers/specs/2026-09-25-scraper-season-mode-config-design.md`

**Working-tree note:** `app/src/app/draft/page.tsx`, `app/src/app/rankings/page.tsx`, `app/src/lib/utils.ts` contain the **uncommitted 2026-09-25 crash fix**. `app/public/players.json` / `app/public/rankings.json` carry the user's own uncommitted data-regeneration changes — never commit or revert those. Task 0 commits the crash fix so Task 7's commits are clean.

---

### Task 0: Commit the existing crash fix

**Files:**
- Commit only: `app/src/app/draft/page.tsx`, `app/src/app/rankings/page.tsx`, `app/src/lib/utils.ts`
- Do NOT touch: `app/public/players.json`, `app/public/rankings.json` (user's own regenerated data artifacts)

- [ ] **Step 1: Confirm the fix is still green**

Run (workdir `app/`): `npx tsc --noEmit && npm run lint`
Expected: typecheck clean; lint reports only pre-existing warnings, no errors.

- [ ] **Step 2: Commit exactly the three source files**

```bash
git add app/src/app/draft/page.tsx app/src/app/rankings/page.tsx app/src/lib/utils.ts
git commit -m "fix: enrich raw players.json with displayPoints to fix external draft board crash"
git status --short
```

Expected: the three files no longer listed as modified; `players.json`/`rankings.json` still show as modified (leave them).

---

### Task 1: pytest setup + `season_config.py`

**Files:**
- Create: `scraper/season_config.py`
- Create: `scraper/tests/test_season_config.py`
- Modify: `scraper/requirements.txt`

- [ ] **Step 1: Add pytest to requirements and install it**

Append one line to `scraper/requirements.txt` (currently requests/beautifulsoup4/lxml/playwright):

```
pytest>=8.4
```

Run (workdir `scraper/`): `venv/bin/pip install -U pytest`
Expected: `Successfully installed pytest-8.x` (or "Requirement already satisfied").

- [ ] **Step 2: Write the failing tests**

Create `scraper/tests/test_season_config.py`:

```python
from datetime import date

import season_config
from season_config import current_nhl_season, nhl_season_code, parse_mode, rank_key


def test_nhl_season_code_from_int():
    assert nhl_season_code(2026) == "20262027"


def test_nhl_season_code_from_str():
    assert nhl_season_code("2025") == "20252026"


def test_current_nhl_season_july_or_later():
    assert current_nhl_season(date(2026, 9, 25)) == "20262027"


def test_current_nhl_season_before_july():
    assert current_nhl_season(date(2026, 2, 1)) == "20252026"


def test_parse_mode_variants():
    assert parse_mode("") == "regular"
    assert parse_mode("r") == "regular"
    assert parse_mode("Regular") == "regular"
    assert parse_mode("p") == "playoffs"
    assert parse_mode("PLAYOFFS") == "playoffs"


def test_parse_mode_invalid_defaults_to_regular(capsys):
    assert parse_mode("hockey") == "regular"
    assert "Unrecognized" in capsys.readouterr().out


def test_rank_key():
    assert rank_key("regular") == "projectedPoints"
    assert rank_key("playoffs") == "projectedPlayoffPoints"


def test_prompt_parses_inputs(monkeypatch):
    answers = iter(["2026", "p"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))
    assert season_config.prompt_season_and_mode() == (2026, "20262027", "playoffs")


def test_prompt_defaults_to_current_season_and_regular(monkeypatch):
    answers = iter(["", ""])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))
    season_year, code, mode = season_config.prompt_season_and_mode()
    assert mode == "regular"
    assert code == season_config.current_nhl_season()
    assert season_year == int(code[:4])
```

- [ ] **Step 3: Run tests to verify they fail**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_season_config.py -v`
Expected: FAIL — collection error `ModuleNotFoundError: No module named 'season_config'`.

- [ ] **Step 4: Implement `scraper/season_config.py`**

```python
"""
Season and draft-mode configuration helpers for the scraper.

All functions are pure (no network) except prompt_season_and_mode, which is a
thin interactive wrapper and is unit-tested with a monkeypatched input().
"""

from datetime import date
from typing import Tuple

REGULAR = "regular"
PLAYOFFS = "playoffs"


def nhl_season_code(start_year) -> str:
    """Convert a season start year (int or str) to the NHL API season code.

    2026 -> "20262027" (YYYYZZZZ where ZZZZ is YYYY+1)
    """
    start = int(start_year)
    return f"{start}{start + 1}"


def current_nhl_season(today: date = None) -> str:
    """Season code for the NHL season containing `today` (defaults to today).

    The season turns over in July: July 2026 or later is 2026-27
    ("20262027"); January-June 2026 is still 2025-26 ("20252026").
    """
    d = today or date.today()
    start = d.year if d.month >= 7 else d.year - 1
    return nhl_season_code(start)


def parse_mode(raw: str) -> str:
    """Parse a mode prompt answer. Empty/invalid input defaults to regular."""
    value = (raw or "").strip().lower()
    if value in ("", "r", "regular"):
        return REGULAR
    if value in ("p", "playoffs"):
        return PLAYOFFS
    print(f"  Unrecognized mode '{raw}', defaulting to {REGULAR}")
    return REGULAR


def rank_key(mode: str) -> str:
    """players.json dict key used to rank players for a draft mode."""
    return "projectedPoints" if mode == REGULAR else "projectedPlayoffPoints"


def prompt_season_and_mode() -> Tuple[int, str, str]:
    """Prompt for season year and draft mode.

    Returns (season_year, season_code, mode). Empty season input defaults
    to the current NHL season; empty mode input defaults to regular.
    """
    raw_season = input("Enter season year (e.g. 2026): ").strip()
    if raw_season:
        season_year = int(raw_season)
    else:
        season_year = int(current_nhl_season()[:4])
    mode = parse_mode(input("Draft mode: (r)egular or (p)layoffs? [regular]: "))
    code = nhl_season_code(season_year)
    print(f"  Using season {season_year}-{season_year + 1} ({code}), mode: {mode}")
    return season_year, code, mode
```

- [ ] **Step 5: Run tests to verify they pass**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_season_config.py -v`
Expected: 10 passed.

- [ ] **Step 6: Commit**

```bash
git add scraper/season_config.py scraper/tests/test_season_config.py scraper/requirements.txt
git commit -m "feat: add season/mode config helpers with tests"
```

---

### Task 2: `preseason.py` — preseason projection math

**Files:**
- Create: `scraper/preseason.py`
- Create: `scraper/tests/test_preseason.py`

- [ ] **Step 1: Write the failing tests**

Create `scraper/tests/test_preseason.py`:

```python
from preseason import preseason_player_fields, resolve_preseason_projection


def test_resolve_prefers_fantasypros():
    preseason_points = {"Nathan MacKinnon": 112.0}
    prev = {"Nathan MacKinnon": {"goals": 53, "assists": 74, "points": 127}}
    assert resolve_preseason_projection("Nathan MacKinnon", preseason_points, prev) == 112.0


def test_resolve_falls_back_to_prev_season_points():
    prev = {"Nathan MacKinnon": {"goals": 53, "assists": 74, "points": 127}}
    assert resolve_preseason_projection("Nathan MacKinnon", {}, prev) == 127.0


def test_resolve_falls_back_when_points_key_missing():
    prev = {"Nathan MacKinnon": {"goals": 53, "assists": 74}}
    assert resolve_preseason_projection("Nathan MacKinnon", {}, prev) == 127.0


def test_resolve_returns_none_when_no_data():
    assert resolve_preseason_projection("Anyone Else", {}, {}) is None


def test_preseason_fields():
    fields = preseason_player_fields(110.0)
    assert fields["goals"] == 0
    assert fields["assists"] == 0
    assert fields["games"] == 0
    assert fields["ppg"] == round(110.0 / 82, 2)
    assert fields["projected_points"] == 110.0
    assert fields["games_remaining"] == 82


def test_preseason_fields_zero_projection():
    fields = preseason_player_fields(0.0)
    assert fields["ppg"] == 0.0
    assert fields["projected_points"] == 0.0
    assert fields["games_remaining"] == 82
```

- [ ] **Step 2: Run tests to verify they fail**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_preseason.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'preseason'`.

- [ ] **Step 3: Implement `scraper/preseason.py`**

```python
"""
Preseason (0 games played) projection math for regular-season drafts.
"""

from typing import Dict, Optional

GAMES_PER_SEASON = 82


def resolve_preseason_projection(
    name: str,
    preseason_points: Dict[str, float],
    prev_season_stats: Dict[str, Dict],
) -> Optional[float]:
    """Pick a preseason projected-points value for a player.

    FantasyPros preseason projection wins; falls back to the player's
    points from the previous season; returns None when neither exists.
    """
    if name in preseason_points:
        return float(preseason_points[name])
    prev = prev_season_stats.get(name)
    if prev:
        points = prev.get("points")
        if points is None:
            points = prev.get("goals", 0) + prev.get("assists", 0)
        return float(points)
    return None


def preseason_player_fields(projected_points: float) -> Dict:
    """Stat fields for a player in a preseason regular-season run.

    No games played yet: actuals are zero, ppg is the full-season
    projection spread over 82 games, and games_remaining is the full season.
    """
    proj = round(float(projected_points), 1)
    return {
        "goals": 0,
        "assists": 0,
        "games": 0,
        "ppg": round(proj / GAMES_PER_SEASON, 2),
        "projected_points": proj,
        "games_remaining": GAMES_PER_SEASON,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_preseason.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add scraper/preseason.py scraper/tests/test_preseason.py
git commit -m "feat: add preseason projection math with tests"
```

---

### Task 3: `scrape_fantasypros_preseason.py` — preseason projections source

**Files:**
- Create: `scraper/scrape_fantasypros_preseason.py`
- Create: `scraper/tests/test_fantasypros_preseason.py`

Note: as of 2026-09-25 FantasyPros' NHL pages are dormant (off-season shells; `/nhl/projections.php` 404s). The parser must still parse correctly when the pages come back; the `< MIN_PLAYERS` rule makes dormant pages fall back cleanly.

- [ ] **Step 1: Write the failing tests**

Create `scraper/tests/test_fantasypros_preseason.py`:

```python
from scrape_fantasypros_preseason import _points_column_index, parse_preseason_points

FIXTURE = """
<html><body>
<table class="ranking-table">
  <thead><tr><th>RK</th><th>PLAYER NAME</th><th>TEAM</th><th>POS</th><th>PROJ. PTS</th><th>AVG.</th></tr></thead>
  <tbody>
    <tr><td>1</td><td class="player"><a href="/nhl/players/nathan-mackinnon.php">Nathan MacKinnon</a></td><td>COL</td><td>C1</td><td>112.3</td><td>1.0</td></tr>
    <tr><td>2</td><td class="player"><a href="/nhl/players/connor-mcdavid.php">Connor McDavid</a></td><td>EDM</td><td>C2</td><td>108.9</td><td>2.0</td></tr>
    <tr><td>3</td><td class="player"><a href="/nhl/players/no-points.php">No Points</a></td><td>CHI</td><td>C3</td><td>&mdash;</td><td>3.0</td></tr>
  </tbody>
</table>
</body></html>
"""


def test_points_column_index():
    assert _points_column_index(["RK", "PLAYER NAME", "TEAM", "POS", "PROJ. PTS"]) == 4
    assert _points_column_index(["RK", "PLAYER NAME", "PTS"]) == 2
    assert _points_column_index(["RK", "PLAYER NAME", "PROJ"]) == -1
    assert _points_column_index(["RK", "PLAYER NAME", "AVG."]) == -1


def test_parses_projected_points_from_fixture():
    points = parse_preseason_points(FIXTURE)
    assert points == {"Nathan MacKinnon": 112.3, "Connor McDavid": 108.9}


def test_skips_rows_without_numeric_points():
    # 'No Points' row has an em-dash in the points column -> excluded
    assert "No Points" not in parse_preseason_points(FIXTURE)


def test_returns_empty_when_no_points_column():
    html = (
        "<table><thead><tr><th>RK</th><th>PLAYER NAME</th><th>AVG.</th></tr></thead>"
        "<tbody><tr><td>1</td><td><a>Nathan MacKinnon</a></td><td>1.0</td></tr></tbody></table>"
    )
    assert parse_preseason_points(html) == {}


def test_returns_empty_for_dormant_shell_page():
    assert parse_preseason_points("<html><body><h1>Fantasy Hockey Articles</h1></body></html>") == {}
```

- [ ] **Step 2: Run tests to verify they fail**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_fantasypros_preseason.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scrape_fantasypros_preseason'`.

- [ ] **Step 3: Implement `scraper/scrape_fantasypros_preseason.py`**

```python
"""
Scrape FantasyPros NHL preseason projections (projected points per player).

Preseason ranking/projection pages only come online close to the new season;
when the pages are dormant or blocked, scrape_preseason_points() returns {}
and the caller falls back to last season's points (see preseason.py).
"""

import re
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.fantasypros.com"
CANDIDATE_URLS = [
    f"{BASE_URL}/nhl/projections.php",
    f"{BASE_URL}/nhl/rankings/consensus.php",
    f"{BASE_URL}/nhl/rankings/consensus-cheatsheet.php",
]
MIN_PLAYERS = 50
HEADERS = {"User-Agent": "Mozilla/5.0"}


def _points_column_index(headers: List[str]) -> int:
    """Index of a projected-points column in a table header, or -1."""
    for i, h in enumerate(headers):
        h_lower = h.lower()
        if "proj" in h_lower and "pt" in h_lower:
            return i
        if h_lower in ("pts", "points"):
            return i
    return -1


def parse_preseason_points(html: str) -> Dict[str, float]:
    """Parse FantasyPros tables into {player name: projected points}.

    Returns {} when no table carries a projected-points column.
    """
    soup = BeautifulSoup(html, "lxml")
    points: Dict[str, float] = {}

    for table in soup.find_all("table"):
        headers = [c.get_text(strip=True) for c in table.find_all("th")]
        col = _points_column_index(headers)
        if col < 0:
            continue

        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) <= col or len(cells) < 2:
                continue
            name_cell = cells[1]
            link = name_cell.find("a")
            name = (link or name_cell).get_text(strip=True)
            if not name:
                continue
            raw_value = re.sub(r"[^\d.]", "", cells[col].get_text(strip=True))
            try:
                value = float(raw_value)
            except ValueError:
                continue
            if value > 0:
                points[name] = value
    return points


def scrape_preseason_points() -> Dict[str, float]:
    """Fetch and parse FantasyPros preseason projected points.

    Tries the known preseason pages; returns {} when none yield a usable
    table (dormant off-season pages, bot protection, layout change).
    """
    for url in CANDIDATE_URLS:
        try:
            print(f"  Fetching FantasyPros preseason projections: {url}")
            response = requests.get(url, headers=HEADERS, timeout=20)
            response.raise_for_status()
        except Exception as e:
            print(f"    Warning: fetch failed: {e}")
            continue

        points = parse_preseason_points(response.text)
        if len(points) >= MIN_PLAYERS:
            print(f"    Parsed {len(points)} player projections")
            return points
        print(f"    Only {len(points)} usable rows at this URL; trying next candidate")

    print("    No FantasyPros preseason projections available (pages may be dormant pre-season)")
    return {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_fantasypros_preseason.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add scraper/scrape_fantasypros_preseason.py scraper/tests/test_fantasypros_preseason.py
git commit -m "feat: add FantasyPros preseason projections scraper with parser tests"
```

Note (spec §8 error handling): if the requests-based scrape proves structurally unusable at implementation time (pages return but projections are JS-only), escalate to the existing Playwright setup (`scrape_stats_playwright.py` pattern) inside `scrape_preseason_points()` — `parse_preseason_points()` stays pure either way. Until then, the `{}` → previous-season fallback keeps preseason runs working.

---

### Task 4: `scrape_rosters.py` — season + mode parameters

**Files:**
- Modify: `scraper/scrape_rosters.py` (`fetch_playoff_teams`/`get_playoff_teams` bodies stay byte-identical)
- Create: `scraper/tests/test_scrape_rosters.py`

- [ ] **Step 1: Write the failing tests**

Create `scraper/tests/test_scrape_rosters.py`:

```python
import scrape_rosters
from scrape_rosters import ALL_TEAMS, roster_teams


def test_regular_mode_scrapes_all_32_teams():
    assert roster_teams("regular") == ALL_TEAMS
    assert len(ALL_TEAMS) == 32


def test_playoffs_mode_uses_detection(monkeypatch):
    monkeypatch.setattr(scrape_rosters, "get_playoff_teams", lambda: ["TBL", "FLA"])
    assert roster_teams("playoffs") == ["TBL", "FLA"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_scrape_rosters.py -v`
Expected: FAIL — `ImportError: cannot import name 'roster_teams'`.

- [ ] **Step 3: Modify `scraper/scrape_rosters.py`**

Replace the module docstring/imports and delete `CURRENT_SEASON = "20252026"` (lines 1-13):

```python
"""
Scrape NHL skater rosters for a season and draft mode.
Skaters only (no goalies) since they score 0 points in this pool.
Uses NHL.com official API.
"""

from typing import List, Dict
import requests
import time

from season_config import current_nhl_season
```

Keep `ALL_TEAMS`, `fetch_playoff_teams`, `get_playoff_teams` unchanged. Replace `scrape_playoff_rosters` with:

```python
def roster_teams(mode: str) -> List[str]:
    """Teams to scrape for a draft mode: all 32 for regular, playoff teams for playoffs."""
    if mode == "regular":
        return list(ALL_TEAMS)
    return get_playoff_teams()


def scrape_rosters(season: str, mode: str) -> List[Dict]:
    """
    Scrape NHL skater rosters for the given season and draft mode.

    Regular mode scrapes all 32 teams; playoffs mode scrapes playoff teams
    (auto-detected from standings, with all-teams fallback).
    """
    teams = roster_teams(mode)
    if mode == "regular":
        print(f"  Regular mode: scraping all {len(teams)} teams")
    rosters = []

    for team_abbr in teams:
        try:
            url = f"https://api-web.nhle.com/v1/roster/{team_abbr}/{season}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Process forwards (C, LW, RW)
            for player in data.get('forwards', []):
                first = player['firstName']['default']
                last = player['lastName']['default']
                position = player['positionCode']  # C, L, R

                # Map position codes to standard names
                pos_map = {'C': 'C', 'L': 'LW', 'R': 'RW'}
                position = pos_map.get(position, position)

                rosters.append({
                    "name": f"{first} {last}",
                    "team": team_abbr,
                    "position": position,
                    "injury": {
                        "status": "healthy",
                        "expectedReturn": None
                    }
                })

            # Process defensemen
            for player in data.get('defensemen', []):
                first = player['firstName']['default']
                last = player['lastName']['default']

                rosters.append({
                    "name": f"{first} {last}",
                    "team": team_abbr,
                    "position": "D",
                    "injury": {
                        "status": "healthy",
                        "expectedReturn": None
                    }
                })

            # Skip goalies - they score 0 points in this pool
            print(f"  {team_abbr}: {len(data.get('forwards', []))} forwards, {len(data.get('defensemen', []))} defensemen")

            time.sleep(0.5)  # Be respectful to API

        except Exception as e:
            print(f"Warning: Failed to scrape {team_abbr} roster: {e}")
            continue

    return rosters
```

Replace the `__main__` block with:

```python
if __name__ == "__main__":
    print("Scraping rosters...")
    rosters = scrape_rosters(current_nhl_season(), 'playoffs')
    print(f"Found {len(rosters)} skaters")

    print("\nSample players:")
    for player in rosters[:5]:
        print(f"  {player['name']} ({player['team']} {player['position']}) - {player['injury']['status']}")
```

- [ ] **Step 4: Run tests to verify they pass**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_scrape_rosters.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scraper/scrape_rosters.py scraper/tests/test_scrape_rosters.py
git commit -m "feat: scrape rosters by season and draft mode"
```

---

### Task 5: Season threading through NHL API + MoneyPuck modules

**Files:**
- Modify: `scraper/scrape_nhl_api.py` (season defaults for `scrape_all_player_stats`, `scrape_player_game_log`)
- Modify: `scraper/scrape_moneypuck.py` (`scrape_player_stats`, `generate_stats_for_player`)
- Create: `scraper/tests/test_season_threading.py`

- [ ] **Step 1: Write the failing tests**

Create `scraper/tests/test_season_threading.py`:

```python
import scrape_moneypuck
from season_config import current_nhl_season


def test_scrape_player_stats_threads_season(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        scrape_moneypuck, "scrape_all_player_stats",
        lambda season: captured.update(season=season) or {},
    )
    scrape_moneypuck.scrape_player_stats("20262027")
    assert captured["season"] == "20262027"


def test_scrape_player_stats_defaults_to_current_season(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        scrape_moneypuck, "scrape_all_player_stats",
        lambda season: captured.update(season=season) or {},
    )
    scrape_moneypuck.scrape_player_stats()
    assert captured["season"] == current_nhl_season()


def test_generate_stats_for_player_threads_season_to_game_log(monkeypatch):
    monkeypatch.setattr(
        scrape_moneypuck, "TOP_PLAYER_STATS",
        {"Test Player": {"games": 80, "goals": 40, "assists": 50, "ppg": 1.125}},
    )
    monkeypatch.setattr(
        scrape_moneypuck, "get_player_id_from_name", lambda name, team: 123
    )
    captured = {}
    monkeypatch.setattr(
        scrape_moneypuck, "scrape_player_game_log",
        lambda player_id, season: captured.update(season=season) or None,
    )
    scrape_moneypuck.generate_stats_for_player("Test Player", "TBL", "C", season="20262027")
    assert captured["season"] == "20262027"
```

- [ ] **Step 2: Run tests to verify they fail**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_season_threading.py -v`
Expected: FAIL — `TypeError: scrape_player_stats() takes 0 positional arguments` (first two tests) and `TypeError: generate_stats_for_player() got an unexpected keyword argument 'season'` (third test).

- [ ] **Step 3: Modify `scraper/scrape_nhl_api.py`**

Add to the imports (after `import json`):

```python
from season_config import current_nhl_season
```

Change the signature and first line of `scrape_all_player_stats` (was `def scrape_all_player_stats(season: str = "20252026")`; keep the rest of the body unchanged):

```python
def scrape_all_player_stats(season: str = None) -> Dict[str, Dict]:
    """
    Scrape complete player stats from NHL API for all players.

    Args:
        season: Season in YYYYYYYY format (default: current NHL season)
    """
    season = season or current_nhl_season()
```

Change the signature and add the same default line inside `scrape_player_game_log` (was `def scrape_player_game_log(player_id: int, season: str = "20252026")`; rest of the body unchanged):

```python
def scrape_player_game_log(player_id: int, season: str = None) -> Optional[Dict]:
    """
    Scrape game log for a specific player to get recent form.
    Uses caching and rate limiting to be respectful of the API.

    Args:
        player_id: NHL player ID
        season: Season in YYYYYYYY format (default: current NHL season)
    """
    season = season or current_nhl_season()
```

- [ ] **Step 4: Modify `scraper/scrape_moneypuck.py`**

Add to the imports (after `from top_players_stats import TOP_PLAYER_STATS`):

```python
from season_config import current_nhl_season
```

Change `scrape_player_stats` (lines 121-129) to:

```python
def scrape_player_stats(season: str = None) -> Dict[str, Dict]:
    """
    Get real player stats from NHL API for a season.

    Args:
        season: Season in YYYYYYYY format (default: current NHL season)

    Returns:
        Dict mapping player name -> {goals, assists, games, ppg, team, position}
    """
    print("Scraping player stats from NHL API...")
    return scrape_all_player_stats(season or current_nhl_season())
```

Change `generate_stats_for_player`'s signature (line 132) to accept the season and pass it to the game log (replace lines 132-155 area):

```python
def generate_stats_for_player(name: str, team: str, position: str, season: str = None) -> Dict:
```

and inside, where the game log is fetched (currently `game_log = scrape_player_game_log(player_id)`):

```python
    season = season or current_nhl_season()
    ...
    game_log = scrape_player_game_log(player_id, season)
```

(Keep the rest of `generate_stats_for_player` — TOP_PLAYER_STATS fallback and synthetic randoms — unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_season_threading.py -v`
Expected: 3 passed.

- [ ] **Step 6: Run all tests so far**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests -v`
Expected: all tests from Tasks 1-5 pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add scraper/scrape_nhl_api.py scraper/scrape_moneypuck.py scraper/tests/test_season_threading.py
git commit -m "feat: thread season through NHL API and stats modules, no hardcoded season defaults"
```

---

### Task 6: `combine.py` — prompts, mode logic, `build_players` merge

**Files:**
- Modify: `scraper/combine.py` (rewrite of `combine_data` + new `resolve_stats`/`build_players`; `save_*` functions and `calculate_projected_playoff_games` unchanged)
- Create: `scraper/tests/test_combine.py`

- [ ] **Step 1: Write the failing tests**

Create `scraper/tests/test_combine.py`:

```python
from combine import build_players, resolve_stats


def make_roster(name, team="TBL", position="C"):
    return {"name": name, "team": team, "position": position,
            "injury": {"status": "healthy", "expectedReturn": None}}


ODDS = {
    "TBL": {"round1": 0.8, "round2": 0.4, "round3": 0.2, "round4": 0.1},
    "CHI": {"round1": 0.5, "round2": 0.2, "round3": 0.1, "round4": 0.05},
}


def test_regular_preseason_uses_fantasypros_projection():
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
        preseason_points={"Nikita Kucherov": 110.0},
    )
    p = players[0]
    assert p["regularSeasonGoals"] == 0
    assert p["regularSeasonAssists"] == 0
    assert p["gamesPlayed"] == 0
    assert p["projectedPoints"] == 110.0
    assert p["pointsPerGame"] == round(110.0 / 82, 2)
    assert p["gamesRemaining"] == 82
    assert p["rank"] == 1


def test_regular_preseason_falls_back_to_prev_season_points():
    prev = {"Nikita Kucherov": {"goals": 44, "assists": 86, "points": 130, "games": 82, "ppg": 1.59}}
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
        preseason_points={}, prev_season_stats=prev,
    )
    assert players[0]["projectedPoints"] == 130.0


def test_regular_preseason_zero_projection_when_no_data():
    players = build_players(
        [make_roster("Rookie McRookieface")], player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
    )
    assert players[0]["projectedPoints"] == 0.0
    assert players[0]["pointsPerGame"] == 0.0


def test_regular_inseason_uses_rest_of_season_math():
    stats = {"Nikita Kucherov": {"name": "Nikita Kucherov", "team": "TBL", "position": "RW",
                                 "goals": 40, "assists": 50, "games": 41, "points": 90, "ppg": 2.2}}
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats=stats, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=False,
    )
    p = players[0]
    assert p["regularSeasonGoals"] == 40
    assert p["regularSeasonAssists"] == 50
    assert p["gamesPlayed"] == 41
    assert p["gamesRemaining"] == 41
    assert p["projectedPoints"] == round(2.2 * 41, 1)


def test_regular_ranks_by_projected_points():
    rosters = [make_roster("Low Proj", "CHI"), make_roster("High Proj", "TBL")]
    preseason_points = {"High Proj": 100.0, "Low Proj": 50.0}
    players = build_players(
        rosters, player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
        preseason_points=preseason_points,
    )
    assert [p["name"] for p in players] == ["High Proj", "Low Proj"]


def test_playoffs_ranks_by_projected_playoff_points():
    stats = {
        "TBL Star": {"name": "TBL Star", "team": "TBL", "position": "C",
                     "goals": 40, "assists": 50, "games": 82, "points": 90, "ppg": 1.1},
        "CHI Star": {"name": "CHI Star", "team": "CHI", "position": "C",
                     "goals": 40, "assists": 50, "games": 82, "points": 90, "ppg": 1.1},
    }
    rosters = [make_roster("CHI Star", "CHI"), make_roster("TBL Star", "TBL")]
    players = build_players(
        rosters, player_stats=stats, team_odds=ODDS, ros_data={},
        mode="playoffs", season="20262027", is_preseason=False,
    )
    assert players[0]["name"] == "TBL Star"  # deeper playoff run -> more projected playoff points
    assert players[0]["rank"] == 1


def test_playoff_points_use_odds():
    stats = {"Nikita Kucherov": {"name": "Nikita Kucherov", "team": "TBL", "position": "RW",
                                 "goals": 44, "assists": 86, "games": 82, "points": 130, "ppg": 1.59}}
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats=stats, team_odds=ODDS, ros_data={},
        mode="regular", season="20262027", is_preseason=False,
    )
    p = players[0]
    expected_games = 7 * (0.8 + 0.4 + 0.2 + 0.1)
    assert p["projectedPlayoffGames"] == round(expected_games, 1)
    assert p["projectedPlayoffPoints"] == round(1.59 * expected_games, 1)


def test_resolve_stats_exact_then_case_insensitive():
    stats = {"nikita kucherov": {"goals": 44, "team": "TBL"}}
    assert resolve_stats("Nikita Kucherov", "TBL", stats) == {"goals": 44, "team": "TBL"}
    assert resolve_stats("Someone Else", "TBL", stats) == {}


def test_resolve_stats_prefers_name_and_team_match():
    stats = {
        "Same Name": {"team": "TBL", "goals": 1},
        "Other Name": {"team": "CHI", "goals": 2},
    }
    # exact key exists for 'Same Name' with team CHI in roster: name+team mismatch -> keep exact-key stats
    assert resolve_stats("Same Name", "CHI", stats) == {"team": "TBL", "goals": 1}
```

- [ ] **Step 2: Run tests to verify they fail**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_combine.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_players'`.

- [ ] **Step 3: Rewrite `scraper/combine.py`**

Replace the entire file with:

```python
"""
Combine all scraper data and calculate regular-season and playoff projections.
"""

import json
import os
from typing import List, Dict, Optional, Tuple

from season_config import prompt_season_and_mode, rank_key, nhl_season_code
from preseason import resolve_preseason_projection, preseason_player_fields
from scrape_rosters import scrape_rosters, get_playoff_teams, ALL_TEAMS
from scrape_moneypuck import (scrape_moneypuck_team_odds, scrape_player_stats,
                              generate_stats_for_player, parse_lines_csv,
                              parse_rankings_csv, download_all_moneypuck_files)
from scrape_fantasypros_ros import load_fantasypros_ros
from scrape_fantasypros_preseason import scrape_preseason_points

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT_PATH = os.path.join(_SCRIPT_DIR, "../app/public/players.json")

GAMES_PER_ROUND = 7


def calculate_projected_playoff_games(odds: Dict[str, float]) -> float:
    expected_games = 0.0
    expected_games += odds.get('round1', 0) * GAMES_PER_ROUND
    expected_games += odds.get('round2', 0) * GAMES_PER_ROUND
    expected_games += odds.get('round3', 0) * GAMES_PER_ROUND
    expected_games += odds.get('round4', 0) * GAMES_PER_ROUND
    return expected_games


def resolve_stats(name: str, team: str, player_stats: Dict[str, Dict]) -> Dict:
    """Find stats for a player by name, then name+team, then case-insensitive name."""
    stats = player_stats.get(name, {})
    if not stats:
        for player_name, player_data in player_stats.items():
            if player_name == name and player_data.get('team') == team:
                stats = player_data
                break
    if not stats:
        name_lower = name.lower()
        for player_name, player_data in player_stats.items():
            if player_name.lower() == name_lower:
                stats = player_data
                break
    return stats


def build_players(
    rosters: List[Dict],
    player_stats: Dict[str, Dict],
    team_odds: Dict[str, Dict[str, float]],
    ros_data: Dict[str, float],
    mode: str,
    season: str,
    is_preseason: bool,
    preseason_points: Optional[Dict[str, float]] = None,
    prev_season_stats: Optional[Dict[str, Dict]] = None,
) -> List[Dict]:
    """Merge rosters, stats, odds, and rankings into the players.json list.

    Preseason regular mode: no games played — actuals are zero and projected
    points come from preseason projections (FantasyPros, then last season's
    points). Otherwise the per-player synthetic-stats fallback stays in place
    (playoffs-mode behavior). Players are ranked by rank_key(mode).
    """
    combined_players = []

    for roster_player in rosters:
        name = roster_player['name']
        team = roster_player['team']
        position = roster_player['position']

        if is_preseason:
            proj = resolve_preseason_projection(
                name, preseason_points or {}, prev_season_stats or {}
            )
            fields = preseason_player_fields(proj if proj is not None else 0.0)
            ppg = fields['ppg']
            goals = fields['goals']
            assists = fields['assists']
            games = fields['games']
            games_remaining = fields['games_remaining']
            projected_points = fields['projected_points']
            last10 = None
            last20 = None
        else:
            # Try to match player by name first (direct lookup)
            stats = resolve_stats(name, team, player_stats)

            # Generate stats if none available (playoffs-mode behavior)
            if not stats:
                stats = generate_stats_for_player(name, team, position, season)

            # Extract stats safely - handle both dict formats
            if isinstance(stats, dict) and 'pointsPerGame' in stats:
                # Stats are already in the right format (from generate_stats_for_player)
                ppg = stats.get('pointsPerGame', 0.0)
                goals = stats.get('regularSeasonGoals', 0)
                assists = stats.get('regularSeasonAssists', 0)
                games = stats.get('gamesPlayed', 0)
                last10 = stats.get('last10Games')
                last20 = stats.get('last20Games')
            else:
                # Stats are from NHL API in different format
                ppg = stats.get('ppg', 0.0)
                goals = stats.get('goals', 0)
                assists = stats.get('assists', 0)
                games = stats.get('games', 0)
                last10 = None
                last20 = None

            games_remaining = max(0, 82 - games)
            projected_points = round(ppg * games_remaining, 1)

        # Get team odds, default to None if no data
        odds = team_odds.get(team, None)

        if odds:
            projected_playoff_games = calculate_projected_playoff_games(odds)
            projected_playoff_points = round(ppg * projected_playoff_games, 1)
        else:
            projected_playoff_games = 0
            projected_playoff_points = 0

        # Get ROS from FantasyPros data (better than ADP for playoff drafts)
        ros_rank = ros_data.get(name)  # Returns None if not found

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

        combined_players.append(player)

    # Rank by the mode's projection key
    combined_players.sort(key=lambda p: p[rank_key(mode)], reverse=True)

    for i, player in enumerate(combined_players):
        player['rank'] = i + 1

    return combined_players


def combine_data() -> Tuple[List[Dict], Dict[str, List[Dict]], List[Dict], List[str]]:
    print("Combining data from all sources...")

    from scrape_nhl_api import clear_cache, get_api_stats
    clear_cache()

    season_year, season_code, mode = prompt_season_and_mode()

    print("  - Fetching rosters...")
    rosters = scrape_rosters(season_code, mode)
    print(f"    Found {len(rosters)} total players")

    print("  - Fetching injury data from ESPN...")
    try:
        from scrape_espn_injuries import scrape_espn_injuries
        injury_data = scrape_espn_injuries()
        print(f"    Found {len(injury_data)} injured players")
    except Exception as e:
        print(f"    Error fetching injury data: {e}")
        print(f"    Continuing with default healthy status for all players")
        injury_data = {}

    for player in rosters:
        name = player['name']
        if name in injury_data:
            player['injury'] = injury_data[name]

    moneypuck_paths = download_all_moneypuck_files(str(season_year))

    print("  - Fetching team advancement odds from MoneyPuck...")
    team_odds = scrape_moneypuck_team_odds(moneypuck_paths.get('simulations_recent.csv'))
    print(f"    Found odds for {len(team_odds)} teams")

    if mode == 'playoffs':
        print("  - Detecting playoff teams from NHL standings...")
        playoff_teams = get_playoff_teams()
        if len(playoff_teams) < len(team_odds):
            print(f"    Zeroing odds for {len(team_odds) - len(playoff_teams)} non-playoff teams")
            for team in list(team_odds.keys()):
                if team not in playoff_teams:
                    team_odds[team] = {'round1': 0, 'round2': 0, 'round3': 0, 'round4': 0}
    else:
        playoff_teams = list(ALL_TEAMS)

    print("  - Fetching player stats...")
    player_stats = scrape_player_stats(season_code)
    print(f"    Found stats for {len(player_stats)} players")

    is_preseason = (mode == 'regular' and len(player_stats) == 0)
    preseason_points: Dict[str, float] = {}
    prev_season_stats: Dict[str, Dict] = {}
    if is_preseason:
        print("  - No stats yet for this season (preseason); loading preseason projections...")
        preseason_points = scrape_preseason_points()
        if not preseason_points:
            print("    FantasyPros preseason projections unavailable; using last season's points")
        prev_season_code = nhl_season_code(season_year - 1)
        prev_season_stats = scrape_player_stats(prev_season_code)
        print(f"    Loaded {len(prev_season_stats)} players from {prev_season_code} as fallback")

    print("  - Loading ROS from FantasyPros (Rest of Season)...")
    ros_data = load_fantasypros_ros()
    print(f"    Found {len(ros_data)} players with ROS data")

    lines_data = {}
    print("  - Loading MoneyPuck regular season lines...")
    lines_data['regular'] = parse_lines_csv(moneypuck_paths.get('lines_regular.csv'))
    print(f"    Found {len(lines_data['regular'])} regular season line combinations")

    print("  - Loading MoneyPuck playoff lines...")
    lines_data['playoffs'] = parse_lines_csv(moneypuck_paths.get('lines_playoffs.csv'))
    print(f"    Found {len(lines_data['playoffs'])} playoff line combinations")

    print("  - Loading MoneyPuck rankings data...")
    rankings_data = parse_rankings_csv(moneypuck_paths.get('rankings.csv'))
    print(f"    Found {len(rankings_data)} team rankings")

    print("  - Merging data...")
    combined_players = build_players(
        rosters, player_stats, team_odds, ros_data, mode, season_code,
        is_preseason, preseason_points, prev_season_stats,
    )
    print(f"  - Combined {len(combined_players)} players")

    api_stats = get_api_stats()
    print(f"  - API Performance:")
    print(f"    Roster requests: {api_stats['roster_requests']} (cached: {api_stats['cached_roster_requests']}, hit rate: {api_stats['roster_cache_hit_rate']})")
    print(f"    Game log requests: {api_stats['game_log_requests']} (cached: {api_stats['cached_game_log_requests']}, hit rate: {api_stats['game_log_cache_hit_rate']})")

    return combined_players, lines_data, rankings_data, playoff_teams


def save_players_json(players: List[Dict], output_path: str = DEFAULT_OUTPUT_PATH):
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(players, f, indent=2)
    print(f"Saved {len(players)} players to {output_path}")


def save_lines_json(lines: Dict[str, List[Dict]], output_path: str = DEFAULT_OUTPUT_PATH):
    for season_type, lines_list in lines.items():
        lines_path = output_path.replace('players.json', f'lines_{season_type}.json')
        os.makedirs(os.path.dirname(lines_path), exist_ok=True)
        with open(lines_path, 'w') as f:
            json.dump(lines_list, f, indent=2)
        print(f"Saved {len(lines_list)} {season_type} line combinations to {lines_path}")


def save_rankings_json(rankings: List[Dict], output_path: str = DEFAULT_OUTPUT_PATH):
    """Save team rankings to JSON file."""
    rankings_path = output_path.replace('players.json', 'rankings.json')
    import os
    os.makedirs(os.path.dirname(rankings_path), exist_ok=True)

    with open(rankings_path, 'w') as f:
        json.dump(rankings, f, indent=2)
    print(f"Saved {len(rankings)} team rankings to {rankings_path}")


def save_teams_json(playoff_teams: List[str], output_path: str = DEFAULT_OUTPUT_PATH):
    teams_path = output_path.replace('players.json', 'teams.json')
    import os
    os.makedirs(os.path.dirname(teams_path), exist_ok=True)
    with open(teams_path, 'w') as f:
        json.dump({"playoff_teams": sorted(playoff_teams)}, f, indent=2)
    print(f"Saved {len(playoff_teams)} playoff teams to {teams_path}")


if __name__ == "__main__":
    players, lines_data, rankings_data, playoff_teams = combine_data()
    save_players_json(players)
    save_lines_json(lines_data)
    save_rankings_json(rankings_data)
    save_teams_json(playoff_teams)

    print("\nTop 5 players:")
    for player in players[:5]:
        injury_note = f" ({player['injury']['status']})" if player['injury']['status'] != 'healthy' else ""
        print(f"  {player['rank']}. {player['name']} - {player['projectedPoints']} pts / {player['projectedPlayoffPoints']} playoff pts{injury_note}")
```

(Note: `run.py` also calls `combine_data()` + the `save_*` functions — signatures unchanged, so `run.py` needs no edits.)

- [ ] **Step 4: Run tests to verify they pass**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests/test_combine.py -v`
Expected: 9 passed.

- [ ] **Step 5: Run the full test suite**

Run (workdir `scraper/`): `venv/bin/python -m pytest tests -v`
Expected: all tests from Tasks 1-6 pass.

- [ ] **Step 6: Commit**

```bash
git add scraper/combine.py scraper/tests/test_combine.py
git commit -m "feat: season/mode-aware combine with preseason projections and mode ranking"
```

### Task 7: Frontend display-field precedence (projections first pre-season)

**Goal:** `enrichDisplayFields` shows actual points once the season is running, but projections (`projectedPoints` / `gamesRemaining`) while `gamesPlayed === 0`, so the pre-season external draft board is draft-usable. Live drafts keep their own season-aware enrichment in `useDraftState` — unaffected.

**Files:**
- Modify `app/src/lib/utils.ts` — amend `enrichDisplayFields` only (keep the `RawPlayer` type and everything else)
- Create `app/scripts/test-enrich-display-fields.ts` — permanent tsx test (repo has no JS test framework; follows the `app/scripts/import-players.ts` script convention; `tsx` is not a devDependency — run via `npx tsx`)

- [ ] **Step 1: Write the test script (RED)**

Create `app/scripts/test-enrich-display-fields.ts`:

```ts
/**
 * Permanent test: enrichDisplayFields display-field precedence.
 * In-season (gamesPlayed > 0): actual G+A / games played.
 * Pre-season (gamesPlayed === 0): projections first — projectedPoints / gamesRemaining.
 * Already-enriched entries pass through untouched.
 *
 * Run from app/: npx tsx scripts/test-enrich-display-fields.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { enrichDisplayFields } from '../src/lib/utils';
import type { Player } from '../src/types/player';

type RawPlayer = Omit<Player, 'displayPoints' | 'displayGames'> &
  Partial<Pick<Player, 'displayPoints' | 'displayGames'>>;

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = Object.is(actual, expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${actual}, expected ${expected}`);
}

function basePlayer(overrides: Partial<RawPlayer> = {}): RawPlayer {
  return {
    name: 'Test Player',
    team: 'TBL',
    position: 'C',
    regularSeasonGoals: 0,
    regularSeasonAssists: 0,
    gamesPlayed: 0,
    pointsPerGame: 0,
    teamAdvancementOdds: { round1: 0.8, round2: 0.4, round3: 0.2, round4: 0.1 },
    projectedPlayoffGames: 10,
    projectedPlayoffPoints: 12,
    gamesRemaining: 82,
    projectedPoints: 0,
    rank: 1,
    injury: { status: 'healthy', expectedReturn: null, description: null },
    ...overrides,
  };
}

// 1. In-season: actuals win over projections.
const inSeason = enrichDisplayFields(
  basePlayer({ gamesPlayed: 82, regularSeasonGoals: 44, regularSeasonAssists: 86, projectedPoints: 90 })
);
check('in-season displayPoints (G+A beats projection)', inSeason.displayPoints, 130);
check('in-season displayGames', inSeason.displayGames, 82);

// 2. Pre-season with projection: projections first.
const preseason = enrichDisplayFields(
  basePlayer({ projectedPoints: 87.5, gamesRemaining: 82 })
);
check('pre-season displayPoints (projection)', preseason.displayPoints, 87.5);
check('pre-season displayGames (gamesRemaining)', preseason.displayGames, 82);

// 3. Pre-season without projection: zero-safe.
const noProj = enrichDisplayFields(basePlayer({ projectedPoints: 0 }));
check('pre-season no-projection displayPoints', noProj.displayPoints, 0);
check('pre-season no-projection displayGames', noProj.displayGames, 82);

// 4. Already enriched: passthrough untouched.
const passthrough = enrichDisplayFields(
  basePlayer({ gamesPlayed: 82, regularSeasonGoals: 20, regularSeasonAssists: 30, displayPoints: 55.5, displayGames: 12 })
);
check('passthrough displayPoints', passthrough.displayPoints, 55.5);
check('passthrough displayGames', passthrough.displayGames, 12);

// 5. Regression: every real players.json entry enriches per the precedence rule.
// Robust to both in-season data (stale file) and pre-season data (after Task 8's run).
const raw = JSON.parse(
  readFileSync(join(__dirname, '..', 'public', 'players.json'), 'utf8')
) as RawPlayer[];
check('players.json has entries', raw.length > 300, true);
for (const p of raw) {
  const e = enrichDisplayFields(p);
  const gp = p.gamesPlayed ?? 0;
  if (gp > 0) {
    if (e.displayPoints !== (p.regularSeasonGoals ?? 0) + (p.regularSeasonAssists ?? 0) || e.displayGames !== gp) {
      failures += 1;
      console.log(`FAIL in-season precedence for ${p.name}: ${e.displayPoints}/${e.displayGames}`);
    }
  } else if (e.displayPoints !== (p.projectedPoints ?? 0) || e.displayGames !== (p.gamesRemaining ?? 0)) {
    failures += 1;
    console.log(`FAIL pre-season precedence for ${p.name}: ${e.displayPoints}/${e.displayGames}`);
  }
}
console.log(`Regression: enriched ${raw.length} real players.json entries`);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
```

- [ ] **Step 2: Run it — confirm RED**

Run (workdir `app/`): `npx tsx scripts/test-enrich-display-fields.ts`

Expected RED: pre-season checks fail (displayPoints 0 vs 87.5; displayGames 0 vs 82 — current impl always uses G+A / gamesPlayed). In-season, passthrough, and regression checks pass on the current in-season data.

- [ ] **Step 3: Amend `enrichDisplayFields` (GREEN)**

In `app/src/lib/utils.ts`, replace the `enrichDisplayFields` function and its doc comment (keep the `RawPlayer` type above it) with:

```ts
/**
 * Add displayPoints/displayGames to a raw players.json entry.
 * Raw scraper data does not include them; live drafts enrich in useDraftState.
 * In-season (gamesPlayed > 0): actual G+A / games played.
 * Pre-season (gamesPlayed === 0): projections first — projectedPoints /
 * gamesRemaining — so the external draft board is usable before the season starts.
 * Already-enriched entries pass through untouched.
 */
export function enrichDisplayFields(player: RawPlayer): Player {
  const gamesPlayed = player.gamesPlayed ?? 0;
  return {
    ...player,
    displayPoints:
      player.displayPoints ??
      (gamesPlayed > 0
        ? (player.regularSeasonGoals ?? 0) + (player.regularSeasonAssists ?? 0)
        : (player.projectedPoints ?? 0)),
    displayGames:
      player.displayGames ??
      (gamesPlayed > 0 ? gamesPlayed : (player.gamesRemaining ?? 0)),
  };
}
```

- [ ] **Step 4: Run the test — confirm GREEN**

Run (workdir `app/`): `npx tsx scripts/test-enrich-display-fields.ts`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 5: Typecheck, lint, build**

Run (workdir `app/`):
- `npx tsc --noEmit` — clean
- `npm run lint` — no new warnings (pre-existing warnings only)
- `npm run build` — succeeds

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/utils.ts app/scripts/test-enrich-display-fields.ts
git commit -m "feat: projections-first display fields for pre-season draft board"
```

### Task 8: End-to-end manual verification (no commit)

**Goal:** Prove the whole flow for the user's actual scenario — a pre-season 2026-27 regular-season external draft — and confirm the board renders with projections.

**Files:** none (verification only — no code changes, no commit)

- [ ] **Step 1: Run the full pipeline**

Run (workdir `scraper/`): `venv/bin/python run.py`
- Season prompt: enter `2026` (→ NHL season `20262027`)
- Mode prompt: enter `r` (→ regular)

Expected flow (pre-season — the 2026-27 NHL season hasn't started):
- Rosters: all 32 teams' forwards + defensemen for `20262027` from the NHL API
- Player stats: 2026-27 game logs empty → `is_preseason` = true → preseason branch
- FantasyPros dormant (verified 2026-09-25) → `{}` → per-player fallback to 2025-26 actual points via `scrape_player_stats('20252026')`
- Output written to `app/public/players.json` + lines/rankings/teams files

- [ ] **Step 2: Sanity-check the output**

Run (workdir `app/`):

```bash
node -e "
const p = require('./public/players.json');
const teams = new Set(p.map(x => x.team));
const sortedDesc = p.every((x, i) => i === 0 || p[i - 1].projectedPoints >= x.projectedPoints);
const nonzeroGP = p.filter(x => x.gamesPlayed > 0).length;
const ranksContiguous = p.every((x, i) => x.rank === i + 1);
const nonzeroProj = p.filter(x => x.projectedPoints > 0).length;
console.log('count:', p.length, '| teams:', teams.size, '| sortedDesc:', sortedDesc, '| nonzeroGP:', nonzeroGP, '| ranks:', ranksContiguous, '| nonzeroProj:', nonzeroProj);
"
```

Expected: count roughly 500-700 skaters; teams: 32; sortedDesc: true; nonzeroGP: 0 (preseason zeroes actuals); ranks: true; nonzeroProj: > 400 (most players have a 2025-26 fallback).

- [ ] **Step 3: Verify the board renders**

Run (workdir `app/`): `npm run dev` → open http://localhost:3000/draft
- Board renders without crashing (the original bug)
- Pre-season data → points column shows projectedPoints (projections first)
- Spot-check a player card: displayPoints equals projectedPoints, displayGames equals 82
- Also check /rankings renders
- Stop the dev server (Ctrl-C)

- [ ] **Step 4: Confirm nothing needs committing**

Run: `git status`
Expected: `app/public/players.json` (+ rankings/lines/teams outputs) modified — these are the user's data artifacts from the fresh pre-season run; **do not commit or revert them**. This is the desired end state: the external draft board is draft-ready with fresh pre-season data. All code changes were committed in Tasks 0-7.

## Expected Final State

- All commits landed (Tasks 0-7): crash fix; season/mode config helpers; preseason projection math; FantasyPros scraper; season/mode rosters; season threading; season/mode-aware combine; projections-first display fields
- `scraper/`: full pytest suite green; prompts (season start year + mode) with safe defaults — no hardcoded season anywhere
- `app/`: display-fields script green; `tsc --noEmit` clean; lint clean (pre-existing warnings only); build succeeds
- Fresh pre-season 2026-27 regular-season `app/public/players.json` (user's data, left uncommitted) → external draft board at `/draft` renders and is draft-usable
- User can re-run the scraper at any time: empty prompts default to the current NHL season and regular mode
