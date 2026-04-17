"""
Scrape player stats using Playwright to render JavaScript pages.
Hockey-Reference loads stats via JS, so we need a headless browser.
"""

import asyncio
from typing import Dict
from playwright.async_api import async_playwright

async def scrape_player_stats_async() -> Dict[str, Dict]:
    """
    Scrape 2025-26 player stats from Hockey-Reference using Playwright.

    Returns:
        Dict mapping player name + team -> {goals, assists, games, ppg, last10, last20}
    """
    stats = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            print("    Loading Hockey-Reference stats page...")
            await page.goto('https://www.hockey-reference.com/leagues/NHL_2026.html', timeout=30000)

            # Wait for page to load and JavaScript to execute
            await page.wait_for_load_state('networkidle', timeout=10000)
            print("    Page loaded, waiting for data tables...")

            # Wait a bit longer for JS data to populate
            await asyncio.sleep(3)

            # Try to find the stats table with different selectors
            table = await page.query_selector('#stats')
            if not table:
                table = await page.query_selector('#stats_skaters')
            if not table:
                table = await page.query_selector('table.stats_table')

            if not table:
                print("    Could not find stats table, checking all tables...")
                tables = await page.query_selector_all('table')
                print(f"    Found {len(tables)} tables total")
                if len(tables) > 0:
                    table = tables[0]  # Use first table

            if not table:
                print("    No tables found, exiting")
                return stats

            print(f"    Found stats table, parsing rows...")

            # Get all rows from the table
            rows = await table.query_selector_all('tbody tr')

            print(f"    Found {len(rows)} rows in table")

            for row in rows:
                # Skip subsection headers
                class_name = await row.get_attribute('class')
                if class_name and 'thead' in str(class_name):
                    continue

                # Get cells
                cells = await row.query_selector_all('td, th')
                if len(cells) < 8:
                    continue

                # Extract data from cells
                name_cell = cells[0]
                name_link = await name_cell.query_selector('a')

                if not name_link and len(cells) > 1:
                    name_cell = cells[1]
                    name_link = await name_cell.query_selector('a')

                if not name_link:
                    continue

                name = await name_link.inner_text()
                name = name.strip()

                # Team - try different cell positions
                team = "UNKNOWN"
                for idx in [2, 3, 4]:
                    if idx < len(cells):
                        test_team = await cells[idx].inner_text()
                        test_team = test_team.strip().upper()
                        if len(test_team) == 3 and test_team.isalpha():
                            team = test_team
                            break

                if team == "UNKNOWN" or team == "Tm":
                    continue

                # Stats: GP, G, A - find by position
                gp, goals, assists = 0, 0, 0

                for idx, cell in enumerate(cells):
                    text = await cell.inner_text()
                    text = text.strip()
                    if text.isdigit():
                        val = int(text)
                        if val >= 50 and val <= 82:  # Games played
                            gp = val
                        elif val >= 0 and val <= 70:  # Goals
                            goals = val
                        elif val >= 0 and val <= 100:  # Assists (could be higher)
                            if idx > 6:  # Assists usually after goals
                                assists = val

                if gp == 0:
                    continue

                ppg = round((goals + assists) / gp, 2)

                key = f"{name}_{team}"
                stats[key] = {
                    "name": name,
                    "team": team,
                    "regularSeasonGoals": goals,
                    "regularSeasonAssists": assists,
                    "gamesPlayed": gp,
                    "pointsPerGame": ppg,
                    "last10Games": None,
                    "last20Games": None,
                }

                # Limit to first 500 players for speed
                if len(stats) >= 500:
                    break

            print(f"    Successfully scraped {len(stats)} players")

        except Exception as e:
            print(f"    Error scraping stats: {e}")

        finally:
            await browser.close()

    return stats


def scrape_player_stats() -> Dict[str, Dict]:
    """
    Synchronous wrapper for async Playwright scraper.
    """
    return asyncio.run(scrape_player_stats_async())


if __name__ == "__main__":
    print("Testing Playwright scraper...")
    stats = scrape_player_stats()
    print(f"Scraped {len(stats)} players")

    for key, player in list(stats.items())[:5]:
        print(f"  {player['name']} ({player['team']}): {player['regularSeasonGoals']}G + {player['regularSeasonAssists']}A = {player['pointsPerGame']} PPG")
