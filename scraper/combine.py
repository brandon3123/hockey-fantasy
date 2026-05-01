"""
Combine all scraper data and calculate playoff projections.
"""

import json
import os
from typing import List, Dict, Optional, Tuple
from scrape_rosters import scrape_playoff_rosters, get_playoff_teams
from scrape_moneypuck import scrape_moneypuck_team_odds, scrape_player_stats, generate_stats_for_player, parse_lines_csv, parse_rankings_csv, download_all_moneypuck_files
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

def combine_data() -> Tuple[List[Dict], Dict[str, List[Dict]], List[Dict]]:
    print("Combining data from all sources...")

    from scrape_nhl_api import clear_cache
    clear_cache()

    season_year = input("Enter season year (e.g. 2025): ").strip()
    if not season_year:
        season_year = "2025"
    print(f"  Using season year: {season_year}")

    print("  - Fetching rosters...")
    rosters = scrape_playoff_rosters()
    print(f"    Found {len(rosters)} total players from all teams")

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

    moneypuck_paths = download_all_moneypuck_files(season_year)

    print("  - Fetching team advancement odds from MoneyPuck...")
    team_odds = scrape_moneypuck_team_odds(moneypuck_paths.get('simulations_recent.csv'))
    print(f"    Found odds for {len(team_odds)} teams")

    print("  - Detecting playoff teams from NHL standings...")
    playoff_teams = get_playoff_teams()
    if playoff_teams:
        print(f"    Zeroing odds for {len(team_odds) - len(playoff_teams)} non-playoff teams")
        for team in list(team_odds.keys()):
            if team not in playoff_teams:
                team_odds[team] = {'round1': 0, 'round2': 0, 'round3': 0, 'round4': 0}

    print("  - Fetching player stats...")
    player_stats = scrape_player_stats()
    print(f"    Found stats for {len(player_stats)} players")

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
        odds = team_odds.get(team, None)

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

    print("\nTop 5 players by projected playoff points:")
    for player in players[:5]:
        injury_note = f" ({player['injury']['status']})" if player['injury']['status'] != 'healthy' else ""
        print(f"  {player['rank']}. {player['name']} - {player['projectedPlayoffPoints']} pts{injury_note}")
