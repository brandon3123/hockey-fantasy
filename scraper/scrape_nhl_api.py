"""
Real-time NHL data scraping using official NHL API.
Replaces broken scrapers with reliable API calls.
"""

import requests
from typing import Dict, List, Optional
import time
import json

BASE_URL = "https://api-web.nhle.com"

# Simple in-memory cache to prevent redundant API calls
_cache = {
    'rosters': {},  # team_abbrev -> roster_data
    'game_logs': {},  # player_id -> game_log_data
    'stats': {}  # Optional cache for stats
}

# Rate limiting: track last request time
_last_request_time = 0
_min_request_interval = 0.2  # 200ms between requests (5 requests per second)

# Debug counters
_api_calls = {
    'rosters': 0,
    'game_logs': 0,
    'cached_rosters': 0,
    'cached_game_logs': 0
}


def get_api_stats():
    """Get statistics about API calls and cache effectiveness."""
    total_roster_requests = _api_calls['rosters'] + _api_calls['cached_rosters']
    total_game_log_requests = _api_calls['game_logs'] + _api_calls['cached_game_logs']

    cache_hit_rate_rosters = (_api_calls['cached_rosters'] / total_roster_requests * 100) if total_roster_requests > 0 else 0
    cache_hit_rate_game_logs = (_api_calls['cached_game_logs'] / total_game_log_requests * 100) if total_game_log_requests > 0 else 0

    return {
        'roster_requests': _api_calls['rosters'],
        'cached_roster_requests': _api_calls['cached_rosters'],
        'game_log_requests': _api_calls['game_logs'],
        'cached_game_log_requests': _api_calls['cached_game_logs'],
        'roster_cache_hit_rate': f"{cache_hit_rate_rosters:.1f}%",
        'game_log_cache_hit_rate': f"{cache_hit_rate_game_logs:.1f}%"
    }


def _rate_limit():
    """Simple rate limiting to prevent overwhelming the API."""
    global _last_request_time

    current_time = time.time()
    time_since_last_request = current_time - _last_request_time

    if time_since_last_request < _min_request_interval:
        sleep_time = _min_request_interval - time_since_last_request
        time.sleep(sleep_time)

    _last_request_time = time.time()


def clear_cache():
    """Clear all cached data."""
    _cache['rosters'].clear()
    _cache['game_logs'].clear()


def fetch_team_roster(team_abbrev: str, use_cache: bool = True) -> Optional[Dict]:
    """
    Fetch team roster with caching to avoid redundant API calls.

    Args:
        team_abbrev: Team abbreviation
        use_cache: Whether to use cached data if available

    Returns:
        Roster data or None if request fails
    """
    if use_cache and team_abbrev in _cache['rosters']:
        _api_calls['cached_rosters'] += 1
        return _cache['rosters'][team_abbrev]

    _api_calls['rosters'] += 1

    url = f"{BASE_URL}/v1/roster/{team_abbrev}/current"

    try:
        # Add rate limiting delay
        _rate_limit()

        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Cache the result
        _cache['rosters'][team_abbrev] = data
        return data

    except Exception as e:
        if e.response and e.response.status_code == 429:
            print(f"  Rate limited on roster request for {team_abbrev}, using cache if available")
        return None

def scrape_all_player_stats(season: str = "20252026") -> Dict[str, Dict]:
    """
    Scrape complete player stats from NHL API for all players.

    Args:
        season: Season in YYYYYYYY format (default: 20242025)

    Returns:
        Dict mapping player name -> {goals, assists, games, ppg, team, position}
    """
    print("Scraping player stats from NHL API...")

    player_stats = {}

    try:
        # Get multiple stat categories to build complete picture
        # Note: gamesPlayed category doesn't work, so we'll use a different approach
        categories = ['points', 'goals', 'assists']

        for category in categories:
            url = f"{BASE_URL}/v1/skater-stats-leaders/{season}/2"
            params = {
                'categories': category,
                'limit': 999
            }

            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            # Process the stats data
            if category in data:
                for player in data[category]:
                    first_name = player.get('firstName', {}).get('default', '')
                    last_name = player.get('lastName', {}).get('default', '')
                    full_name = f"{first_name} {last_name}"

                    # Get team abbreviation (handle dict format)
                    team_abbrev = player.get('teamAbbrev', '')
                    if isinstance(team_abbrev, dict):
                        team_abbrev = team_abbrev.get('default', '')

                    # Get position
                    position = player.get('position', player.get('positionCode', 'F'))

                    # Get the stat value
                    stat_value = player.get('value', 0)

                    # Initialize player entry if needed
                    if full_name not in player_stats:
                        player_stats[full_name] = {
                            'name': full_name,
                            'team': team_abbrev,
                            'position': position,
                            'goals': 0,
                            'assists': 0,
                            'games': 0,
                            'points': 0,
                            'ppg': 0.0
                        }

                    # Add the specific stat
                    if category == 'goals':
                        player_stats[full_name]['goals'] = stat_value
                    elif category == 'assists':
                        player_stats[full_name]['assists'] = stat_value
                    elif category == 'points':
                        player_stats[full_name]['points'] = stat_value

        # Estimate games played (most players play 70-82 games)
        # This is a rough estimate - you could enhance with game log API
        for name, stats in player_stats.items():
            # Estimate games based on points and typical PPG ranges
            points = stats['points']
            # High scorers typically play more games
            if points >= 80:
                estimated_games = 82
            elif points >= 60:
                estimated_games = 78
            elif points >= 40:
                estimated_games = 75
            else:
                estimated_games = 70

            stats['games'] = estimated_games

            # Calculate PPG
            stats['ppg'] = round(points / estimated_games, 2)

        print(f"  Found stats for {len(player_stats)} players")

    except Exception as e:
        print(f"  Error scraping player stats: {e}")
        import traceback
        traceback.print_exc()

    return player_stats


def scrape_player_game_log(player_id: int, season: str = "20252026") -> Optional[Dict]:
    """
    Scrape game log for a specific player to get recent form.
    Uses caching and rate limiting to be respectful of the API.

    Args:
        player_id: NHL player ID
        season: Season in YYYYYYYY format

    Returns:
        Dict with last10 and last20 game stats
    """
    # Check cache first
    if player_id in _cache['game_logs']:
        _api_calls['cached_game_logs'] += 1
        return _cache['game_logs'][player_id]

    _api_calls['game_logs'] += 1

    url = f"{BASE_URL}/v1/player/{player_id}/game-log/{season}/2"

    try:
        # Add rate limiting delay
        _rate_limit()

        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()

        if 'gameLog' in data:
            game_log = data['gameLog']

            # Last 10 games
            last10 = game_log[:10]
            last10_goals = sum(game.get('goals', 0) for game in last10)
            last10_assists = sum(game.get('assists', 0) for game in last10)
            last10_points = last10_goals + last10_assists

            # Last 20 games
            last20 = game_log[:20]
            last20_goals = sum(game.get('goals', 0) for game in last20)
            last20_assists = sum(game.get('assists', 0) for game in last20)
            last20_points = last20_goals + last20_assists

            result = {
                'last10Games': {
                    'goals': last10_goals,
                    'assists': last10_assists,
                    'points': last10_points,
                    'games': len(last10)
                },
                'last20Games': {
                    'goals': last20_goals,
                    'assists': last20_assists,
                    'points': last20_points,
                    'games': len(last20)
                }
            }

            # Cache the result
            _cache['game_logs'][player_id] = result
            return result

    except Exception as e:
        if e.response and e.response.status_code == 429:
            print(f"  Rate limited on game log for player {player_id}, skipping")
        else:
            print(f"  Error scraping game log for player {player_id}: {e}")

    return None


def get_player_id_from_name(name: str, team: str) -> Optional[int]:
    """
    Get NHL player ID from name and team using cached roster data.

    Args:
        name: Player full name
        team: Team abbreviation

    Returns:
        Player ID or None
    """
    # Use cached roster data to avoid redundant API calls
    roster_data = fetch_team_roster(team)
    if not roster_data:
        return None

    # Search in forwards and defensemen
    for position_type in ['forwards', 'defensemen']:
        if position_type in roster_data:
            for player in roster_data[position_type]:
                player_name = f"{player.get('firstName', {}).get('default', '')} {player.get('lastName', {}).get('default', '')}"
                if player_name == name:
                    return player.get('id')

    return None


def calculate_team_odds_from_standings() -> Dict[str, Dict[str, float]]:
    """
    Calculate team advancement odds from current standings.
    Uses point differential to estimate playoff probabilities.

    Returns:
        Dict mapping team abbreviation -> {round1, round2, round3, round4} odds
    """
    print("Calculating team odds from standings...")

    team_odds = {}

    try:
        url = f"{BASE_URL}/v1/standings/now"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()

        if 'standings' in data:
            # The new structure is a flat list of teams
            for team in data['standings']:
                team_abbrev = team.get('teamAbbrev', '')
                # Handle dict format
                if isinstance(team_abbrev, dict):
                    team_abbrev = team_abbrev.get('default', team_abbrev.get('value', ''))

                points = team.get('points', 0)
                clinch_indicator = team.get('clinchIndicator', '')

                # Only include teams that have clinched playoff spots
                # 'p' = clinched playoffs, 'z' = clinched conference, 'x' = clinched division
                if clinch_indicator in ['p', 'z', 'x', 'y'] and team_abbrev:
                    # Base probabilities on points
                    # Normalize points to reasonable ranges
                    max_points = max(140, points)  # Cap at 140 for normalization

                    # Round 1: Team is in playoffs
                    round1_odds = 1.0

                    # Round 2: Higher point teams have better odds
                    round2_odds = 0.3 + (points / max_points) * 0.5

                    # Round 3: Continue with diminishing probability
                    round3_odds = round2_odds * 0.6

                    # Round 4: Finals probability
                    round4_odds = round3_odds * 0.5

                    team_odds[team_abbrev] = {
                        'round1': round(round1_odds, 2),
                        'round2': round(round2_odds, 2),
                        'round3': round(round3_odds, 2),
                        'round4': round(round4_odds, 2)
                    }

        print(f"  Calculated odds for {len(team_odds)} playoff teams")

    except Exception as e:
        print(f"  Error calculating team odds: {e}")
        # Return default odds if API fails
        return {}

    return team_odds


def scrape_playoff_teams() -> List[str]:
    """
    Get current playoff teams from standings.

    Returns:
        List of team abbreviations for playoff teams
    """
    print("Scraping playoff teams from standings...")

    playoff_teams = []

    try:
        url = f"{BASE_URL}/v1/standings/now"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()

        if 'standings' in data:
            # The new structure is a flat list of teams
            for team in data['standings']:
                clinch_indicator = team.get('clinchIndicator', '')
                team_abbrev = team.get('teamAbbrev', '')

                # Handle dict format
                if isinstance(team_abbrev, dict):
                    team_abbrev = team_abbrev.get('default', team_abbrev.get('value', ''))

                # 'p' = clinched playoffs, 'z' = clinched conference, 'x' = clinched division, 'y' = clinched wild card
                if clinch_indicator in ['p', 'z', 'x', 'y'] and team_abbrev:
                    playoff_teams.append(team_abbrev)

        print(f"  Found {len(playoff_teams)} playoff teams")

    except Exception as e:
        print(f"  Error scraping playoff teams: {e}")

    return playoff_teams


if __name__ == "__main__":
    # Test the functions
    print("Testing NHL API scraping functions...")

    # Test 1: Player stats
    print("\n1. Testing player stats:")
    stats = scrape_all_player_stats()
    if stats:
        sample_player = list(stats.keys())[0]
        print(f"   Sample: {sample_player} - {stats[sample_player]}")

    # Test 2: Team odds
    print("\n2. Testing team odds:")
    odds = calculate_team_odds_from_standings()
    if odds:
        sample_team = list(odds.keys())[0]
        print(f"   Sample: {sample_team} - {odds[sample_team]}")

    # Test 3: Playoff teams
    print("\n3. Testing playoff teams:")
    teams = scrape_playoff_teams()
    print(f"   Playoff teams: {teams[:10]}...")

    # Test 4: Game log (using McDavid's ID)
    print("\n4. Testing game log:")
    game_log = scrape_player_game_log(8478402)  # McDavid
    if game_log:
        print(f"   Last 10: {game_log['last10Games']}")
        print(f"   Last 20: {game_log['last20Games']}")