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
