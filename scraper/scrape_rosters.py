"""
Scrape NHL playoff rosters with injury status.
Skaters only (no goalies) since they score 0 points in this pool.
Uses NHL.com official API.
"""

from typing import List, Dict
import requests
import time

# NHL.com API - use 2025-26 season (current season)
# Format: YYYYZZZZ where ZZZZ is YYYY+1
CURRENT_SEASON = "20252026"

# All 32 NHL teams
ALL_TEAMS = [
    "ANA", "UTA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI",
    "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL",
    "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA",
    "SJS", "STL", "TBL", "TOR", "VAN", "VGK", "WPG", "WSH"
]

# 2026 Stanley Cup Playoff teams (16 teams) - Based on NHL API "If Playoffs Started Today"
PLAYOFF_TEAMS_2026 = [
    # Eastern Conference
    "BUF", "BOS", "TBL", "MTL", "CAR", "OTT", "PHI", "PIT",
    # Western Conference
    "LAK", "COL", "MIN", "DAL", "VGK", "UTA", "EDM", "ANA"
]

def scrape_playoff_rosters() -> List[Dict]:
    """
    Scrape NHL rosters using official NHL.com API.

    Returns:
        List of skaters with name, team, position, injury status
    """
    rosters = []

    for team_abbr in ALL_TEAMS:
        try:
            url = f"https://api-web.nhle.com/v1/roster/{team_abbr}/{CURRENT_SEASON}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Process forwards (C, LW, RW)
            for player in data.get('forwards', []):
                first = player['firstName']['default']
                last = player['lastName']['default']
                position = player['positionCode']  # C, L, R

                # Map position codes to standard names
                pos_map = {'C': 'C', 'L': 'LW', 'R': 'RW'}
                position = pos_map.get(position, position)

                rosters.append({
                    "name": f"{first} {last}",
                    "team": team_abbr,
                    "position": position,
                    "injury": {
                        "status": "healthy",
                        "expectedReturn": None
                    }
                })

            # Process defensemen
            for player in data.get('defensemen', []):
                first = player['firstName']['default']
                last = player['lastName']['default']

                rosters.append({
                    "name": f"{first} {last}",
                    "team": team_abbr,
                    "position": "D",
                    "injury": {
                        "status": "healthy",
                        "expectedReturn": None
                    }
                })

            # Skip goalies - they score 0 points in this pool
            print(f"  {team_abbr}: {len(data.get('forwards', []))} forwards, {len(data.get('defensemen', []))} defensemen")

            time.sleep(0.5)  # Be respectful to API

        except Exception as e:
            print(f"Warning: Failed to scrape {team_abbr} roster: {e}")
            continue

    return rosters

def scrape_injury_report() -> Dict[str, Dict]:
    """
    Scrape injury data from ESPN.
    Returns dict mapping player name -> injury status.
    """
    from scrape_espn_injuries import scrape_espn_injuries
    return scrape_espn_injuries()

if __name__ == "__main__":
    # Scrape rosters
    print("Scraping playoff rosters...")
    rosters = scrape_playoff_rosters()
    print(f"Found {len(rosters)} playoff skaters")

    # Print sample
    print("\nSample players:")
    for player in rosters[:5]:
        print(f"  {player['name']} ({player['team']} {player['position']}) - {player['injury']['status']}")
