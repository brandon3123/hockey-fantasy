"""
Combine all scraper data and calculate playoff projections.
"""

import json
import os
from typing import List, Dict, Optional, Tuple
from scrape_rosters import scrape_playoff_rosters
from scrape_moneypuck import scrape_team_advancement_odds, scrape_player_stats, generate_stats_for_player, parse_lines_csv
from scrape_fantasypros_ros import load_fantasypros_ros

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

def combine_data() -> Tuple[List[Dict], List[Dict]]:
    print("Combining data from all sources...")

    # Clear any cached data from previous runs
    from scrape_nhl_api import clear_cache
    clear_cache()

    print("  - Fetching rosters...")
    rosters = scrape_playoff_rosters()

    # Import playoff teams list
    from scrape_rosters import PLAYOFF_TEAMS_2026

    # Filter to only playoff teams
    playoff_rosters = [p for p in rosters if p['team'] in PLAYOFF_TEAMS_2026]
    print(f"    Found {len(rosters)} total players, {len(playoff_rosters)} from playoff teams")

    # Scrape injury data from ESPN
    print("  - Fetching injury data from ESPN...")
    try:
        from scrape_espn_injuries import scrape_espn_injuries
        injury_data = scrape_espn_injuries()
    except ImportError:
        print("    Warning: playwright not installed, using empty injury data")
        injury_data = {}
    print(f"    Found {len(injury_data)} injured players")

    # Merge injury data onto rosters
    for player in playoff_rosters:
        name = player['name']
        if name in injury_data:
            player['injury'] = injury_data[name]

    # Filter out players out for playoffs
    rosters = [p for p in playoff_rosters if p['injury']['status'] != 'out for playoffs']
    print(f"    Found {len(rosters)} eligible players after injury filter")

    print("  - Fetching team advancement odds...")
    team_odds = scrape_team_advancement_odds()
    print(f"    Found odds for {len(team_odds)} teams")

    print("  - Fetching player stats...")
    player_stats = scrape_player_stats()
    print(f"    Found stats for {len(player_stats)} players")

    print("  - Loading ROS from FantasyPros (Rest of Season)...")
    ros_data = load_fantasypros_ros()
    print(f"    Found {len(ros_data)} players with ROS data")

    print("  - Loading MoneyPuck lines data...")
    lines_data = parse_lines_csv()
    print(f"    Found {len(lines_data)} line combinations")

    print("  - Merging data...")
    combined_players = []

    for roster_player in rosters:
        name = roster_player['name']
        team = roster_player['team']
        position = roster_player['position']

        # Try to match player by name first (direct lookup)
        stats = player_stats.get(name, {})

        # If no direct match, try to find by name and team (for players with same name)
        if not stats:
            for player_name, player_data in player_stats.items():
                if player_name == name and player_data.get('team') == team:
                    stats = player_data
                    break

        # If still no match, try case-insensitive name match
        if not stats:
            name_lower = name.lower()
            for player_name, player_data in player_stats.items():
                if player_name.lower() == name_lower:
                    stats = player_data
                    break

        # Generate realistic stats if none available (for demo/testing)
        if not stats:
            stats = generate_stats_for_player(name, team, position)

        # Get team odds, default to 50/25/12/6 if no data
        odds = team_odds.get(team, {
            'round1': 0.5,
            'round2': 0.25,
            'round3': 0.12,
            'round4': 0.06,
        })

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

        projected_games = calculate_projected_playoff_games(odds)
        projected_points = ppg * projected_games

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
            'teamAdvancementOdds': {
                'round1': round(odds['round1'], 2),
                'round2': round(odds['round2'], 2),
                'round3': round(odds['round3'], 2),
                'round4': round(odds['round4'], 2),
            },
            'projectedPlayoffGames': round(projected_games, 1),
            'projectedPlayoffPoints': round(projected_points, 1),
            'adp': round(ros_rank, 1) if ros_rank else None,  # Using ROS data (better than ADP for playoffs)
            'injury': roster_player['injury'],
        }

        combined_players.append(player)

    # Rank by projected points
    print("  - Ranking players...")
    combined_players.sort(key=lambda p: p['projectedPlayoffPoints'], reverse=True)

    for i, player in enumerate(combined_players):
        player['rank'] = i + 1
        # ADP already loaded from FreshSheets, keeping as-is

    print(f"  - Combined {len(combined_players)} players")

    # Report API usage statistics
    from scrape_nhl_api import get_api_stats
    api_stats = get_api_stats()
    print(f"  - API Performance:")
    print(f"    Roster requests: {api_stats['roster_requests']} (cached: {api_stats['cached_roster_requests']}, hit rate: {api_stats['roster_cache_hit_rate']})")
    print(f"    Game log requests: {api_stats['game_log_requests']} (cached: {api_stats['cached_game_log_requests']}, hit rate: {api_stats['game_log_cache_hit_rate']})")

    return combined_players, lines_data

def save_players_json(players: List[Dict], output_path: str = DEFAULT_OUTPUT_PATH):
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(players, f, indent=2)
    print(f"Saved {len(players)} players to {output_path}")

def save_lines_json(lines: List[Dict], output_path: str = DEFAULT_OUTPUT_PATH):
    """Save line combinations to JSON file."""
    lines_path = output_path.replace('players.json', 'lines.json')
    import os
    os.makedirs(os.path.dirname(lines_path), exist_ok=True)

    with open(lines_path, 'w') as f:
        json.dump(lines, f, indent=2)
    print(f"Saved {len(lines)} line combinations to {lines_path}")

if __name__ == "__main__":
    players, lines_data = combine_data()
    save_players_json(players)
    save_lines_json(lines_data)

    print("\nTop 5 players by projected playoff points:")
    for player in players[:5]:
        injury_note = f" ({player['injury']['status']})" if player['injury']['status'] != 'healthy' else ""
        print(f"  {player['rank']}. {player['name']} - {player['projectedPlayoffPoints']} pts{injury_note}")
