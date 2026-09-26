"""
ADP data for the draft board.

The live FantasyPros ADP page is the source (it is the only FantasyPros data
available pre-season); the manual CSV export stays as a fallback so the `adp`
field is never empty.
"""

import csv
import re
import unicodedata
from typing import Dict, Optional

ADP_URL = "https://www.fantasypros.com/nhl/adp/overall.php"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
}
REQUEST_TIMEOUT = 25
# The name cell holds "Firstname Lastname" plus a trailing team code, e.g. "Nathan MacKinnonCOL".
NAME_WITH_TEAM_RE = re.compile(r"^(.*?)\s*([A-Z]{2,3})$")
AVG_COLUMN = 5
MIN_CELLS = 6

def load_fantasypros_adp(csv_path: str = "fantasy-pros/adp.csv") -> Dict[str, float]:
    """
    Load ADP data from FantasyPros CSV.

    Args:
        csv_path: Path to FantasyPros adp.csv file

    Returns:
        Dict mapping player name -> ADP value
    """
    adp_data = {}

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)

            # Skip header row
            next(reader, None)

            # Column indices (0-based):
            # B=1: PLAYER NAME, H=7: AVG. (ADP)
            for row in reader:
                if len(row) < 8:
                    continue

                try:
                    # Extract player name (column B, index 1)
                    player_name = row[1].strip()

                    # Extract ADP average (column H, index 7)
                    adp_value = row[7].strip()

                    # Skip if no player name or invalid ADP
                    if not player_name or not adp_value or adp_value == 'AVG.':
                        continue

                    # Convert ADP to float
                    adp_float = float(adp_value)

                    # Store player ADP
                    adp_data[player_name] = adp_float

                except (ValueError, IndexError) as e:
                    # Skip malformed rows
                    continue

        print(f"  Loaded {len(adp_data)} player ADP values from FantasyPros")
        return adp_data

    except FileNotFoundError:
        print(f"  FantasyPros CSV not found at {csv_path}")
        return {}
    except Exception as e:
        print(f"  Error loading FantasyPros ADP: {e}")
        return {}

def _split_name_and_team(cell: str) -> str:
    """Player name without the team code the live page appends to the cell."""
    text = re.sub(r"\s+", " ", (cell or "")).strip()
    match = NAME_WITH_TEAM_RE.match(text)
    if match and match.group(1).strip():
        return match.group(1).strip()
    return text

def parse_adp_table(html: str) -> Dict[str, float]:
    """Parse the live ADP page into {player name: averaged ADP}.

    Rows without a numeric rank or a numeric average are skipped, which also
    takes care of the header row and the "last updated" table.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or "", "lxml")
    adp: Dict[str, float] = {}

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < MIN_CELLS:
                continue
            if not cells[0].get_text(strip=True).isdigit():
                continue
            name = _split_name_and_team(cells[1].get_text(strip=True))
            try:
                value = float(cells[AVG_COLUMN].get_text(strip=True))
            except ValueError:
                continue
            if name and value > 0:
                adp[name] = value
    return adp

def scrape_fantasypros_adp(url: str = ADP_URL) -> Dict[str, float]:
    """Fetch and parse live FantasyPros ADP; {} when the page is unreachable."""
    import requests

    try:
        response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
    except Exception as e:
        print(f"  Warning: FantasyPros ADP fetch failed: {e}")
        return {}

    adp = parse_adp_table(response.text)
    print(f"  Scraped {len(adp)} live ADP values from FantasyPros")
    return adp

def resolve_adp(live_adp: Dict[str, float], fallback_adp: Dict[str, float]) -> Dict[str, float]:
    """Prefer the live scrape; fall back to the manual export when it's empty."""
    return live_adp or fallback_adp


def normalize_player_name(name: str) -> str:
    """Fold a name to a form both data sources agree on.

    FantasyPros writes "Tim Stutzle" while the NHL API writes "Tim Stützle",
    so a raw comparison silently drops the ADP for every accented player.
    Punctuation is removed rather than turned into a separator: "O'Reilly"
    becomes "oreilly", not "o reilly", so nothing collides.
    """
    decomposed = unicodedata.normalize("NFKD", name)
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z ]", "", without_accents.lower()).strip()


def build_adp_index(adp: Dict[str, float]) -> Dict[str, float]:
    """Rekey an ADP dict by normalized name so lookups survive accents."""
    return {normalize_player_name(name): value for name, value in adp.items()}


def lookup_adp(index: Dict[str, float], name: str) -> Optional[float]:
    """Find a player's ADP by normalized name; None when they aren't listed."""
    return index.get(normalize_player_name(name))

def get_sample_adp(adp_data: Dict[str, float], count: int = 10):
    """Show sample ADP data for verification."""
    print(f"\n  Sample FantasyPros ADP data:")
    # Sort by ADP value (lower = better)
    sorted_players = sorted(adp_data.items(), key=lambda x: x[1])
    for player, adp in sorted_players[:count]:
        print(f"    {adp}. {player}")

if __name__ == "__main__":
    # Test loading ADP data
    adp_data = load_fantasypros_adp()

    if adp_data:
        print(f"✅ Successfully loaded {len(adp_data)} ADP values")
        get_sample_adp(adp_data)

        # Show some specific players
        players_to_check = ['Connor McDavid', 'Nathan MacKinnon', 'Nikita Kucherov']
        print(f"\n  Key players FantasyPros ADP:")
        for player in players_to_check:
            if player in adp_data:
                print(f"    {player}: {adp_data[player]}")
            else:
                print(f"    {player}: NOT FOUND")
    else:
        print("❌ No ADP data loaded")
