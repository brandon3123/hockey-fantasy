"""
Scrape FantasyPros for expert rankings and ADP data.
"""

import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import time

BASE_URL = "https://www.fantasypros.com"

def scrape_playoff_rankings() -> List[Dict]:
    """
    Scrape FantasyPros NHL playoff rankings.

    Returns:
        List of {rank, name, team, position, adp}
    """
    rankings = []

    try:
        # FantasyPros NHL playoff rankings page
        url = f"{BASE_URL}/nhl/rankings/playoff-consensus.php"
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Parse rankings table
        table = soup.find('table', {'class': 'ranking-table'})
        if not table:
            # Try alternate selector
            table = soup.find('table', id='rankings')

        if table:
            rows = table.find_all('tr')[1:]  # Skip header

            for row in rows:
                cells = row.find_all('td')
                if len(cells) < 4:
                    continue

                rank_cell = cells[0].get_text(strip=True)
                name = cells[1].get_text(strip=True)
                team = cells[2].get_text(strip=True).upper()
                position = cells[3].get_text(strip=True).upper()

                # Try to find ADP if in separate column
                adp = None
                if len(cells) > 5:
                    try:
                        adp = float(cells[5].get_text())
                    except ValueError:
                        pass

                rankings.append({
                    "rank": int(rank_cell) if rank_cell.isdigit() else len(rankings) + 1,
                    "name": name,
                    "team": team,
                    "position": position,
                    "adp": adp,
                })

    except Exception as e:
        print(f"Warning: Failed to scrape playoff rankings: {e}")
        # Try fallback to regular season rankings
        print("Attempting fallback to regular season rankings...")
        try:
            url = f"{BASE_URL}/nhl/rankings/consensus-cheatsheet.php"
            response = requests.get(url, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')
            # Similar parsing logic...

        except Exception as e2:
            print(f"Fallback also failed: {e2}")

    return rankings

def scrape_adp_data() -> Dict[str, float]:
    """
    Scrape Average Draft Position data.

    Returns:
        Dict mapping player name -> ADP
    """
    adp = {}

    try:
        url = f"{BASE_URL}/nhl/adp.php"
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Parse ADP table
        table = soup.find('table', {'class': 'adp-table'})
        if table:
            rows = table.find_all('tr')[1:]

            for row in rows:
                cells = row.find_all('td')
                if len(cells) < 2:
                    continue

                name = cells[0].get_text(strip=True)
                adp_value = cells[1].get_text(strip=True)

                try:
                    adp[name] = float(adp_value)
                except ValueError:
                    continue

    except Exception as e:
        print(f"Warning: Failed to scrape ADP: {e}")

    return adp

if __name__ == "__main__":
    print("Scraping playoff rankings...")
    rankings = scrape_playoff_rankings()
    print(f"Found {len(rankings)} ranked players")
    for player in rankings[:5]:
        adp_str = f" (ADP: {player['adp']})" if player['adp'] else ""
        print(f"  {player['rank']}. {player['name']} ({player['team']}){adp_str}")

    print("\nScraping ADP data...")
    adp = scrape_adp_data()
    print(f"Found ADP for {len(adp)} players")
