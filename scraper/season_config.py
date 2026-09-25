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
