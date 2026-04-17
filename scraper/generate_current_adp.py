"""
Generate current ADP data from real NHL stats.
Replaces outdated FreshSheets projections with live 2025-26 data.
"""

from scrape_nhl_api import scrape_all_player_stats
from typing import Dict, List

def generate_current_adp() -> Dict[str, float]:
    """
    Generate ADP data from current NHL stats.
    ADP = Rank by fantasy points (real performance > projections).

    Returns:
        Dict mapping player name -> ADP value (rank-based)
    """
    print("Generating current ADP from live NHL stats...")

    # Get real current stats
    player_stats = scrape_all_player_stats()

    # Calculate fantasy points for each player
    # Standard fantasy scoring: Goals + Assists + bonus stats
    player_fantasy_points = {}

    for name, stats in player_stats.items():
        # Basic fantasy scoring: Goals (2pts) + Assists (1pt) + PPP (0.5pt)
        fantasy_points = (
            stats['goals'] * 2 +
            stats['assists'] * 1 +
            stats.get('ppg', 0) * 0.5 * stats['games']
        )

        player_fantasy_points[name] = fantasy_points

    # Sort by fantasy points descending
    ranked_players = sorted(
        player_fantasy_points.items(),
        key=lambda x: x[1],
        reverse=True
    )

    # Generate ADP (rank = draft position)
    adp_data = {}
    for rank, (name, points) in enumerate(ranked_players, 1):
        adp_data[name] = float(rank)

    print(f"  Generated {len(adp_data)} current ADP values")
    return adp_data

def get_top_players_adp(adp_data: Dict[str, float], count: int = 10):
    """Show top players for verification."""
    # Sort by ADP (lower = better)
    sorted_players = sorted(adp_data.items(), key=lambda x: x[1])

    print(f"\n  Top {count} players by current ADP:")
    for name, adp in sorted_players[:count]:
        print(f"    {adp:.1f}. {name}")

if __name__ == "__main__":
    adp_data = generate_current_adp()

    if adp_data:
        print("✅ Current ADP data generated")
        get_top_players_adp(adp_data)

        # Compare with key players
        key_players = ['Connor McDavid', 'Nathan MacKinnon', 'Nikita Kucherov']
        print(f"\n  Key players current ADP:")
        for player in key_players:
            if player in adp_data:
                print(f"    {player}: {adp_data[player]}")
