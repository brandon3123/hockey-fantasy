"""
Preseason (0 games played) projection math for regular-season drafts.
"""

import unicodedata

from typing import Dict, Optional

GAMES_PER_SEASON = 82


def _normalize_name(name: str) -> str:
    """Casefolded, accent-stripped name for cross-source name matching.

    FantasyPros renders names in ASCII ("Tomas Hertl") while NHL API
    roster names carry accents ("Tomáš Hertl"); both normalize to the
    same key so projections match across sources.
    """
    text = unicodedata.normalize("NFKD", name)
    text = text.encode("ascii", "ignore").decode("ascii")
    return " ".join(text.casefold().split())


def resolve_preseason_projection(
    name: str,
    preseason_points: Dict[str, float],
    prev_season_stats: Dict[str, Dict],
) -> Optional[float]:
    """Pick a preseason projected-points value for a player.

    FantasyPros preseason projection wins; falls back to the player's
    points from the previous season; returns None when neither exists.
    Accented-name mismatches across sources (FantasyPros ASCII vs NHL
    API accents) resolve via a casefolded, accent-stripped comparison,
    after exact-key lookups.
    """
    if name in preseason_points:
        return float(preseason_points[name])
    normalized = _normalize_name(name)
    for fp_name, points in preseason_points.items():
        if _normalize_name(fp_name) == normalized:
            return float(points)
    prev = prev_season_stats.get(name)
    if prev is None:
        for stats_name, stats in prev_season_stats.items():
            if _normalize_name(stats_name) == normalized:
                prev = stats
                break
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
