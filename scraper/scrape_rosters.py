"""
Scrape NHL playoff rosters with injury status.
Skaters only (no goalies) since they score 0 points in this pool.
"""

from typing import List, Dict, Optional
import requests
from bs4 import BeautifulSoup
import time

BASE_URL = "https://www.nhl.com"

def scrape_playoff_rosters() -> List[Dict]:
    """
    Scrape active NHL playoff rosters with injury information.

    Returns:
        List of skaters with name, team, position, injury status, expected return
    """
    rosters = []

    # NHL teams that made playoffs (update this list each playoff year)
    # For 2026 playoffs, we'd scrape this dynamically or hardcode
    playoff_teams = [
        "COL", "EDM", "VAN", "WPG",  # Pacific / Central
        "FLA", "CAR", "NYR", "BOS",  # Atlantic / Metropolitan
        # Add remaining playoff teams based on current year
    ]

    for team_abbr in playoff_teams:
        try:
            # Try NHL.com roster page first
            url = f"{BASE_URL}/club/roster/{team_abbr}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Parse roster table (adjust selectors based on actual HTML structure)
            player_rows = soup.select('table tbody tr')

            for row in player_rows:
                cells = row.find_all('td')
                if not cells:
                    continue

                position = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                name = cells[0].get_text(strip=True) if cells else ""

                # Skip goalies (G) - they don't score points in this pool
                if position == "G" or not position:
                    continue

                # Only include skaters (C, LW, RW, D)
                if position not in ["C", "LW", "RW", "D"]:
                    continue

                rosters.append({
                    "name": name,
                    "team": team_abbr,
                    "position": position,
                    "injury": {
                        "status": "healthy",
                        "expectedReturn": None
                    }
                })

            time.sleep(1)  # Be respectful to servers

        except Exception as e:
            print(f"Warning: Failed to scrape {team_abbr} roster: {e}")
            continue

    return rosters

def scrape_injury_report() -> Dict[str, Dict]:
    """
    Scrape injury report from a site like Daily Faceoff or ESPN.

    Returns:
        Dict mapping player name -> {status, expectedReturn}
    """
    injuries = {}

    try:
        # Daily Faceoff injury report (example URL structure)
        url = "https://www.dailyfaceoff.com/news/nhl-injury-report/"
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Parse injury table (adjust selectors based on actual HTML)
        injury_rows = soup.select('table.injury-report tbody tr')

        for row in injury_rows:
            cells = row.find_all('td')
            if len(cells) < 3:
                continue

            name = cells[0].get_text(strip=True)
            status = cells[1].get_text(strip=True).lower()
            expected_return = cells[2].get_text(strip=True) if len(cells) > 2 else None

            # Map various status strings to our standard
            if "day to day" in status or "day-to-day" in status:
                standard_status = "day-to-day"
            elif "week to week" in status or "week-to-week" in status:
                standard_status = "week-to-week"
            elif "out indefinitely" in status:
                standard_status = "out indefinitely"
            elif "out for season" in status or "out for playoffs" in status:
                standard_status = "out for playoffs"
            else:
                standard_status = "healthy" if status == "healthy" else "day-to-day"

            injuries[name] = {
                "status": standard_status,
                "expectedReturn": expected_return if expected_return else None
            }

    except Exception as e:
        print(f"Warning: Failed to scrape injury report: {e}")

    return injuries

def combine_rosters_with_injuries(rosters: List[Dict], injuries: Dict[str, Dict]) -> List[Dict]:
    """Merge roster data with injury information."""
    for player in rosters:
        name = player["name"]
        if name in injuries:
            player["injury"] = injuries[name]

    return rosters

if __name__ == "__main__":
    # Scrape rosters
    print("Scraping playoff rosters...")
    rosters = scrape_playoff_rosters()
    print(f"Found {len(rosters)} playoff skaters")

    # Scrape injuries
    print("Scraping injury report...")
    injuries = scrape_injury_report()
    print(f"Found {len(injuries)} injured players")

    # Combine
    rosters = combine_rosters_with_injuries(rosters, injuries)

    # Print sample
    print("\nSample players:")
    for player in rosters[:5]:
        print(f"  {player['name']} ({player['team']} {player['position']}) - {player['injury']['status']}")
