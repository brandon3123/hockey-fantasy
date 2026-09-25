"""
Scrape FantasyPros NHL preseason projections (projected points per player).

Preseason ranking/projection pages only come online close to the new season;
when the pages are dormant or blocked, scrape_preseason_points() returns {}
and the caller falls back to last season's points (see preseason.py).
"""

import re
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.fantasypros.com"
CANDIDATE_URLS = [
    f"{BASE_URL}/nhl/projections.php",
    f"{BASE_URL}/nhl/rankings/consensus.php",
    f"{BASE_URL}/nhl/rankings/consensus-cheatsheet.php",
]
MIN_PLAYERS = 50
HEADERS = {"User-Agent": "Mozilla/5.0"}


def _points_column_index(headers: List[str]) -> int:
    """Index of a projected-points column in a table header, or -1."""
    for i, h in enumerate(headers):
        h_lower = h.lower()
        if "proj" in h_lower and "pt" in h_lower:
            return i
        if h_lower in ("pts", "points"):
            return i
    return -1


def parse_preseason_points(html: str) -> Dict[str, float]:
    """Parse FantasyPros tables into {player name: projected points}.

    Returns {} when no table carries a projected-points column.
    """
    soup = BeautifulSoup(html, "lxml")
    points: Dict[str, float] = {}

    for table in soup.find_all("table"):
        headers = [c.get_text(strip=True) for c in table.find_all("th")]
        col = _points_column_index(headers)
        if col < 0:
            continue

        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) <= col or len(cells) < 2:
                continue
            name_cell = cells[1]
            link = name_cell.find("a")
            name = (link or name_cell).get_text(strip=True)
            if not name:
                continue
            raw_value = re.sub(r"[^\d.]", "", cells[col].get_text(strip=True))
            try:
                value = float(raw_value)
            except ValueError:
                continue
            if value > 0:
                points[name] = value
    return points


def scrape_preseason_points() -> Dict[str, float]:
    """Fetch and parse FantasyPros preseason projected points.

    Tries the known preseason pages; returns {} when none yield a usable
    table (dormant off-season pages, bot protection, layout change).
    """
    for url in CANDIDATE_URLS:
        try:
            print(f"  Fetching FantasyPros preseason projections: {url}")
            response = requests.get(url, headers=HEADERS, timeout=20)
            response.raise_for_status()
        except Exception as e:
            print(f"    Warning: fetch failed: {e}")
            continue

        points = parse_preseason_points(response.text)
        if len(points) >= MIN_PLAYERS:
            print(f"    Parsed {len(points)} player projections")
            return points
        print(f"    Only {len(points)} usable rows at this URL; trying next candidate")

    print("    No FantasyPros preseason projections available (pages may be dormant pre-season)")
    return {}
