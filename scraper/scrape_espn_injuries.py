"""
Scrape NHL injury data from ESPN using Playwright.
Returns dict mapping player name -> injury status
"""

from playwright.sync_api import sync_playwright
from typing import Dict
import time

def scrape_espn_injuries(url: str = "https://www.espn.com/nhl/injuries") -> Dict[str, Dict]:
    """
    Scrape ESPN injury page and return injury data.

    Returns:
        Dict mapping player name -> {status, expectedReturn}
    """
    injuries = {}

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, timeout=30000)

            # Wait for page to load
            page.wait_for_selector('table', timeout=15000)
            time.sleep(2)  # Extra wait for dynamic content

            # Get all rows from all tables
            rows = page.query_selector_all('table tr')

            for row in rows[1:]:  # Skip header rows
                try:
                    cols = row.query_selector_all('td')
                    if len(cols) < 4:
                        continue

                    name = cols[0].inner_text().strip()
                    position = cols[1].inner_text().strip() if len(cols) > 1 else ""
                    date_col = cols[2].inner_text().strip() if len(cols) > 2 else ""
                    status_col = cols[3].inner_text().strip() if len(cols) > 3 else ""
                    desc_col = cols[4].inner_text().strip() if len(cols) > 4 else ""

                    if not name:
                        continue

                    # Map ESPN status to our format
                    if status_col == 'Day-To-Day':
                        injury_status = 'day-to-day'
                    elif status_col == 'Out':
                        # Check if return date is Sep 15 (season-ending)
                        if 'Sep' in date_col and '15' in date_col:
                            injury_status = 'out for playoffs'
                        else:
                            injury_status = 'week-to-week'
                    elif status_col == 'Injured Reserve':
                        # IR is usually serious
                        if 'Sep' in date_col and '15' in date_col:
                            injury_status = 'out for playoffs'
                        else:
                            injury_status = 'out indefinitely'
                    else:
                        injury_status = 'week-to-week'

                    injuries[name] = {
                        'status': injury_status,
                        'expectedReturn': date_col if date_col != 'Sep 15' else None,
                        'description': desc_col if desc_col else None
                    }

                except Exception as e:
                    continue

            browser.close()
            print(f"  Loaded {len(injuries)} injuries from ESPN")
            return injuries

        except Exception as e:
            print(f"  Error scraping ESPN injuries: {e}")
            return {}

def show_sample_injuries(injuries: Dict[str, Dict], count: int = 10):
    """Show sample injury data for verification."""
    print(f"\n  Sample ESPN injury data:")
    for i, (player, data) in enumerate(list(injuries.items())[:count]):
        print(f"    {player}: {data['status']} (return: {data['expectedReturn']})")

if __name__ == "__main__":
    injuries = scrape_espn_injuries()

    if injuries:
        print(f"✅ Successfully loaded {len(injuries)} injuries")
        show_sample_injuries(injuries)
    else:
        print("❌ No injury data loaded")
