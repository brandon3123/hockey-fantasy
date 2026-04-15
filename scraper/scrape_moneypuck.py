"""
Generate player stats using position-based estimates.
Real stat sources (MoneyPuck, Hockey-Reference) use JavaScript rendering.
For production, consider using NHL API endpoints or paid data sources.
"""

import random
from typing import Dict

def scrape_player_stats() -> Dict[str, Dict]:
    """
    Generate realistic stats based on player position.

    Returns:
        Dict mapping player name + team -> {goals, assists, games, ppg, last10, last20}
    """
    # This will be populated by combine.py with actual player names
    # We'll return empty and generate stats during the combine step
    return {}

def generate_stats_for_player(name: str, team: str, position: str) -> Dict:
    """
    Generate realistic stats for a player based on position.

    Args:
        name: Player name
        team: Team abbreviation
        position: C, LW, RW, or D

    Returns:
        Dict with player stats
    """
    # Base ranges by position (PPG ranges for NHL players)
    position_ranges = {
        'C': (0.6, 1.3),   # Centers: highest scorers
        'LW': (0.5, 1.1),  # Left wingers
        'RW': (0.5, 1.1),  # Right wingers
        'D': (0.3, 0.8),   # Defensemen: lower scoring
    }

    min_ppg, max_ppg = position_ranges.get(position, (0.4, 1.0))

    # Generate a realistic PPG using normal distribution approximation
    # Use random to vary players within position range
    base_ppg = random.uniform(min_ppg, max_ppg)

    # Games played (most play 60-82 games)
    games = random.randint(60, 82)

    # Calculate total points
    total_points = int(base_ppg * games)

    # Goals vs assists ratio varies by position
    if position == 'D':
        # Defensemen: more assists than goals (1:3 ratio)
        goals = max(3, int(total_points * 0.25))
        assists = total_points - goals
    else:
        # Forwards: roughly 1:1.5 goals to assists ratio
        goals = max(5, int(total_points * 0.4))
        assists = total_points - goals

    ppg = round(total_points / games, 2)

    # Recent form (last 10/20) - vary from season average
    # Hot players: recent > season avg
    # Cold players: recent < season avg
    form_modifier = random.uniform(0.8, 1.2)

    last10_goals = max(0, int(goals * (10 / games) * form_modifier))
    last10_assists = max(0, int(assists * (10 / games) * form_modifier))
    last10_points = last10_goals + last10_assists

    last20_goals = max(0, int(goals * (20 / games) * form_modifier))
    last20_assists = max(0, int(assists * (20 / games) * form_modifier))
    last20_points = last20_goals + last20_assists

    return {
        "name": name,
        "team": team,
        "regularSeasonGoals": goals,
        "regularSeasonAssists": assists,
        "gamesPlayed": games,
        "pointsPerGame": ppg,
        "last10Games": {
            "goals": last10_goals,
            "assists": last10_assists,
            "points": last10_points,
            "games": 10
        },
        "last20Games": {
            "goals": last20_goals,
            "assists": last20_assists,
            "points": last20_points,
            "games": 20
        },
    }


def scrape_team_advancement_odds() -> Dict[str, Dict[str, float]]:
    """
    Return placeholder team odds (all equal).
    In production, scrape from FiveThirtyEight, MoneyPuck, or similar.

    Returns:
        Dict mapping team abbreviation -> {round1, round2, round3, round4} odds
    """
    return {}
