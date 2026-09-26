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
from scrape_fantasypros_adp import (
    scrape_fantasypros_adp, resolve_adp, build_adp_index, lookup_adp,
)
from scrape_puckpedia_lines import scrape_puckpedia_lines, select_lines

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
    adp_index = build_adp_index(ros_data)

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

        # Get ROS from FantasyPros data (better than ADP for playoff drafts).
        # Matched on the normalized name: FantasyPros drops accents that the
        # NHL API keeps, so an exact lookup would lose the ADP for those
        # players (e.g. "Tim Stutzle" vs "Tim Stützle").
        ros_rank = lookup_adp(adp_index, name)  # Returns None if not found

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


def load_adp_data() -> Dict[str, float]:
    """ADP for the `adp` field: the live FantasyPros page, else the manual export."""
    print("  - Scraping ADP from FantasyPros...")
    live_adp = scrape_fantasypros_adp()
    if live_adp:
        print(f"    Using {len(live_adp)} live ADP values")
        return resolve_adp(live_adp, {})

    print("    Live ADP unavailable; falling back to the local FantasyPros export")
    fallback = load_fantasypros_ros()
    print(f"    Found {len(fallback)} players in the fallback export")
    return resolve_adp({}, fallback)


def skip_puckpedia() -> bool:
    """SKIP_PUCKPEDIA_LINES=1 runs the scraper without the depth-chart crawl.

    The crawl is slow (one page per skater) and only buys current lines, so it
    can be switched off while working on the rest of the pipeline.
    """
    return os.environ.get('SKIP_PUCKPEDIA_LINES', '').strip().lower() in ('1', 'true', 'yes')


def load_line_data(rosters: List[Dict], moneypuck_paths: Dict[str, str],
                   mode: str) -> Dict[str, List[Dict]]:
    """Line combinations per season type.

    Regular-season lines come from PuckPedia depth charts, which are current
    pre-season; the MoneyPuck CSVs only refresh once games are played, so they
    stay as the fallback. Playoff lines have no PuckPedia equivalent and always
    come from MoneyPuck.
    """
    moneypuck_regular = parse_lines_csv(moneypuck_paths.get('lines_regular.csv'))
    moneypuck_playoffs = parse_lines_csv(moneypuck_paths.get('lines_playoffs.csv'))
    print(f"    Found {len(moneypuck_regular)} MoneyPuck regular season line combinations")
    print(f"    Found {len(moneypuck_playoffs)} MoneyPuck playoff line combinations")

    if mode == 'playoffs':
        return {'regular': moneypuck_regular, 'playoffs': moneypuck_playoffs}

    if skip_puckpedia():
        print("    Skipping PuckPedia depth charts (SKIP_PUCKPEDIA_LINES is set)")
        return {'regular': moneypuck_regular, 'playoffs': moneypuck_playoffs}

    try:
        puckpedia_lines = scrape_puckpedia_lines(rosters)
    except Exception as e:
        print(f"    Error scraping PuckPedia lines: {e}")
        print(f"    Falling back to MoneyPuck lines")
        puckpedia_lines = []

    if puckpedia_lines:
        print(f"    Using {len(puckpedia_lines)} PuckPedia lines from current depth charts")
    else:
        print(f"    No PuckPedia lines; falling back to MoneyPuck lines")
    return {'regular': select_lines(puckpedia_lines, moneypuck_regular),
            'playoffs': moneypuck_playoffs}


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

    print("  - Loading ADP for the draft board...")
    adp_data = load_adp_data()

    print("  - Loading line combinations...")
    lines_data = load_line_data(rosters, moneypuck_paths, mode)

    print("  - Loading MoneyPuck rankings data...")
    rankings_data = parse_rankings_csv(moneypuck_paths.get('rankings.csv'))
    print(f"    Found {len(rankings_data)} team rankings")

    print("  - Merging data...")
    combined_players = build_players(
        rosters, player_stats, team_odds, adp_data, mode, season_code,
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
