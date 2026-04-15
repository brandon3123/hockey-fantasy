"""
Combine all scraper data and calculate playoff projections.
"""

import json
from typing import List, Dict, Optional
from scrape_rosters import scrape_playoff_rosters, scrape_injury_report, combine_rosters_with_injuries
from scrape_moneypuck import scrape_team_advancement_odds, scrape_player_stats
from scrape_fantasypros import scrape_playoff_rankings, scrape_adp_data

GAMES_PER_ROUND = 7

def calculate_projected_playoff_games(odds: Dict[str, float]) -> float:
    expected_games = 0.0
    expected_games += odds.get('round1', 0) * GAMES_PER_ROUND
    expected_games += odds.get('round2', 0) * GAMES_PER_ROUND
    expected_games += odds.get('round3', 0) * GAMES_PER_ROUND
    expected_games += odds.get('round4', 0) * GAMES_PER_ROUND
    return expected_games

def combine_data() -> List[Dict]:
    print("Combining data from all sources...")

    print("  - Fetching rosters and injuries...")
    rosters = scrape_playoff_rosters()
    injuries = scrape_injury_report()
    rosters = combine_rosters_with_injuries(rosters, injuries)

    # Filter out players out for playoffs
    rosters = [p for p in rosters if p['injury']['status'] != 'out for playoffs']
    print(f"    Found {len(rosters)} eligible players")

    print("  - Fetching team advancement odds...")
    team_odds = scrape_team_advancement_odds()
    print(f"    Found odds for {len(team_odds)} teams")

    print("  - Fetching player stats...")
    player_stats = scrape_player_stats()
    print(f"    Found stats for {len(player_stats)} players")

    print("  - Fetching rankings and ADP...")
    rankings = scrape_playoff_rankings()
    adp_data = scrape_adp_data()
    print(f"    Found {len(rankings)} ranked players, {len(adp_data)} ADP entries")

    print("  - Merging data...")
    combined_players = []

    for roster_player in rosters:
        name = roster_player['name']
        team = roster_player['team']
        position = roster_player['position']

        stat_key = f"{name}_{team}"
        stats = player_stats.get(stat_key, {})

        # If no exact match, try name-only match (for traded players)
        if not stats:
            for key, value in player_stats.items():
                if value['name'] == name and value['team'] == team:
                    stats = value
                    break

        # Get team odds, default to 50/25/12/6 if no data
        odds = team_odds.get(team, {
            'round1': 0.5,
            'round2': 0.25,
            'round3': 0.12,
            'round4': 0.06,
        })

        ppg = stats.get('pointsPerGame', 0.0)
        projected_games = calculate_projected_playoff_games(odds)
        projected_points = ppg * projected_games

        # Find ADP from rankings first, then ADP data
        adp = None
        for ranked_player in rankings:
            if ranked_player['name'] == name:
                adp = ranked_player.get('adp')
                if not adp:
                    adp = float(ranked_player.get('rank', 0))
                break

        if not adp:
            adp = adp_data.get(name)

        player = {
            'name': name,
            'team': team,
            'position': position,
            'regularSeasonGoals': stats.get('regularSeasonGoals', 0),
            'regularSeasonAssists': stats.get('regularSeasonAssists', 0),
            'gamesPlayed': stats.get('gamesPlayed', 0),
            'pointsPerGame': round(ppg, 2),
            'last10Games': stats.get('last10Games'),
            'last20Games': stats.get('last20Games'),
            'teamAdvancementOdds': {
                'round1': round(odds['round1'], 2),
                'round2': round(odds['round2'], 2),
                'round3': round(odds['round3'], 2),
                'round4': round(odds['round4'], 2),
            },
            'projectedPlayoffGames': round(projected_games, 1),
            'projectedPlayoffPoints': round(projected_points, 1),
            'adp': round(adp, 1) if adp else None,
            'injury': roster_player['injury'],
        }

        combined_players.append(player)

    # Rank by projected points
    print("  - Ranking players...")
    combined_players.sort(key=lambda p: p['projectedPlayoffPoints'], reverse=True)

    for i, player in enumerate(combined_players):
        player['rank'] = i + 1

    print(f"  - Combined {len(combined_players)} players")

    return combined_players

def save_players_json(players: List[Dict], output_path: str = "../app/public/players.json"):
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(players, f, indent=2)
    print(f"Saved {len(players)} players to {output_path}")

if __name__ == "__main__":
    players = combine_data()
    save_players_json(players)

    print("\nTop 5 players by projected playoff points:")
    for player in players[:5]:
        injury_note = f" ({player['injury']['status']})" if player['injury']['status'] != 'healthy' else ""
        print(f"  {player['rank']}. {player['name']} - {player['projectedPlayoffPoints']} pts{injury_note}")
