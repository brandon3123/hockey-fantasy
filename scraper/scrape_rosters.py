"""
Scrape NHL skater rosters for a season and draft mode.
Skaters only (no goalies) since they score 0 points in this pool.
Uses NHL.com official API.
"""

from typing import List, Dict
import requests
import time

from season_config import current_nhl_season

ALL_TEAMS = [
    "ANA", "UTA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI",
    "COL", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL",
    "NJD", "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA",
    "SJS", "STL", "TBL", "TOR", "VAN", "VGK", "WPG", "WSH"
]


def fetch_playoff_teams() -> List[str]:
    """
    Fetch current playoff teams from NHL standings API.
    Returns list of team abbreviations.
    """
    try:
        response = requests.get("https://api-web.nhle.com/v1/standings/now", timeout=15)
        response.raise_for_status()
        data = response.json()

        playoff_teams = []
        for team in data.get('standings', []):
            clinch = team.get('clinchIndicator', '')
            if clinch in ('p', 'x', 'y', 'z'):
                abbrev = team.get('teamAbbrev', {})
                if isinstance(abbrev, dict):
                    abbrev = abbrev.get('default', '')
                if abbrev:
                    playoff_teams.append(abbrev)

        if playoff_teams:
            print(f"  Detected {len(playoff_teams)} playoff teams: {', '.join(sorted(playoff_teams))}")
            return playoff_teams
    except Exception as e:
        print(f"  Warning: Could not fetch playoff teams from standings: {e}")

    return []


def get_playoff_teams() -> List[str]:
    """
    Get current playoff teams, auto-detected from NHL API.
    Falls back to all teams if detection fails.
    """
    teams = fetch_playoff_teams()
    if teams:
        return teams
    print("  Falling back to all teams (could not detect playoff teams)")
    return ALL_TEAMS

def roster_teams(mode: str) -> List[str]:
    """Teams to scrape for a draft mode: all 32 for regular, playoff teams for playoffs."""
    if mode == "regular":
        return list(ALL_TEAMS)
    return get_playoff_teams()


def scrape_rosters(season: str, mode: str) -> List[Dict]:
    """
    Scrape NHL skater rosters for the given season and draft mode.

    Regular mode scrapes all 32 teams; playoffs mode scrapes playoff teams
    (auto-detected from standings, with all-teams fallback).
    """
    teams = roster_teams(mode)
    if mode == "regular":
        print(f"  Regular mode: scraping all {len(teams)} teams")
    rosters = []

    for team_abbr in teams:
        try:
            url = f"https://api-web.nhle.com/v1/roster/{team_abbr}/{season}"
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
    print("Scraping rosters...")
    rosters = scrape_rosters(current_nhl_season(), 'playoffs')
    print(f"Found {len(rosters)} skaters")

    print("\nSample players:")
    for player in rosters[:5]:
        print(f"  {player['name']} ({player['team']} {player['position']}) - {player['injury']['status']}")
