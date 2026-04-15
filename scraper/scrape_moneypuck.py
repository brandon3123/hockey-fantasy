"""
Scrape MoneyPuck for team advancement odds and player stats.
"""

import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import time
import json

BASE_URL = "https://moneypuck.com"

def scrape_team_advancement_odds() -> Dict[str, Dict[str, float]]:
    """
    Scrape MoneyPuck playoff advancement probabilities.

    Returns:
        Dict mapping team abbreviation -> {round1, round2, round3, round4} odds
    """
    odds = {}

    try:
        # MoneyPuck predictions page
        url = f"{BASE_URL}/predictions.htm"
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Parse playoff odds table (adjust based on actual structure)
        # MoneyPuck uses embedded JSON or tables - need to inspect actual page
        tables = soup.find_all('table')

        for table in tables:
            # Look for playoff odds table
            headers = [th.get_text(strip=True).lower() for th in table.find_all('th')]
            if 'team' in headers and 'make playoffs' in ' '.join(headers):
                rows = table.find_all('tr')[1:]  # Skip header

                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) < 5:
                        continue

                    team_cell = cells[0].get_text(strip=True)
                    # Extract team abbreviation from full name
                    # This varies by team - need mapping or parse from URL

                    # For now, assume first 3 letters as abbr (will need proper mapping)
                    team_abbr = team_cell[:3].upper()

                    # Parse round-by-round odds
                    odds[team_abbr] = {
                        "round1": float(cells[1].get_text()) / 100 if cells[1].get_text() else 0.0,
                        "round2": float(cells[2].get_text()) / 100 if len(cells) > 2 and cells[2].get_text() else 0.0,
                        "round3": float(cells[3].get_text()) / 100 if len(cells) > 3 and cells[3].get_text() else 0.0,
                        "round4": float(cells[4].get_text()) / 100 if len(cells) > 4 and cells[4].get_text() else 0.0,
                    }

    except Exception as e:
        print(f"Warning: Failed to scrape team odds: {e}")
        # Return empty dict so combine.py can handle gracefully
        return {}

    return odds

def scrape_player_stats() -> Dict[str, Dict]:
    """
    Scrape player regular season stats from MoneyPuck.

    Returns:
        Dict mapping player name + team -> {goals, assists, games, ppg, last10, last20}
    """
    stats = {}

    try:
        # MoneyPuck stats page
        url = f"{BASE_URL}/stats.htm"
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Look for skater stats table
        tables = soup.find_all('table')

        for table in tables:
            headers = [th.get_text(strip=True).lower() for th in table.find_all('th')]
            if 'player' in headers and 'goals' in headers and 'assists' in headers:
                rows = table.find_all('tr')[1:]

                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) < 6:
                        continue

                    name = cells[0].get_text(strip=True)
                    team = cells[1].get_text(strip=True).upper()

                    # Parse stats
                    goals = int(cells[2].get_text()) if cells[2].get_text().isdigit() else 0
                    assists = int(cells[3].get_text()) if cells[3].get_text().isdigit() else 0
                    games = int(cells[4].get_text()) if cells[4].get_text().isdigit() else 0

                    ppg = (goals + assists) / games if games > 0 else 0.0

                    # Try to find last 10/20 game splits if available
                    last10 = None
                    last20 = None

                    if len(cells) > 10:
                        # Look for recent game columns
                        # Adjust indices based on actual table structure
                        pass

                    key = f"{name}_{team}"
                    stats[key] = {
                        "name": name,
                        "team": team,
                        "regularSeasonGoals": goals,
                        "regularSeasonAssists": assists,
                        "gamesPlayed": games,
                        "pointsPerGame": ppg,
                        "last10Games": last10,
                        "last20Games": last20,
                    }

                break  # Found the stats table, move on

    except Exception as e:
        print(f"Warning: Failed to scrape player stats: {e}")

    return stats

if __name__ == "__main__":
    print("Scraping team advancement odds...")
    odds = scrape_team_advancement_odds()
    print(f"Found odds for {len(odds)} teams")
    for team, team_odds in list(odds.items())[:3]:
        print(f"  {team}: R1={team_odds['round1']:.2%}, R2={team_odds['round2']:.2%}")

    print("\nScraping player stats...")
    stats = scrape_player_stats()
    print(f"Found stats for {len(stats)} players")
    for key, player in list(stats.items())[:3]:
        print(f"  {player['name']} ({player['team']}): {player['regularSeasonGoals']}G + {player['regularSeasonAssists']}A = {player['pointsPerGame']:.2f} PPG")
