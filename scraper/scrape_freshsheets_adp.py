"""
Load ADP data from FreshSheets CSV.
Scott Cullen's FreshSheets provides quality ADP data.
"""

import csv
from typing import Dict

def load_freshsheets_adp(csv_path: str = "freesheets/rankings.csv") -> Dict[str, float]:
    """
    Load ADP data from FreshSheets rankings CSV.

    Args:
        csv_path: Path to FreshSheets rankings.csv file

    Returns:
        Dict mapping player name -> ADP value
    """
    adp_data = {}

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)

            # Skip header rows (first 3 rows are headers)
            for _ in range(3):
                next(reader, None)

            # Column indices (0-based):
            # B=1: ADP, D=3: PLAYER, H=7: TEAM, I=8: POS
            for row in reader:
                if len(row) < 4:
                    continue

                try:
                    # Extract player name (column D, index 3)
                    player_name = row[3].strip()

                    # Extract ADP (column B, index 1)
                    adp_value = row[1].strip()

                    # Skip if no player name or invalid ADP
                    if not player_name or not adp_value or adp_value == 'ADP':
                        continue

                    # Convert ADP to float
                    adp_float = float(adp_value)

                    # Store player ADP
                    adp_data[player_name] = adp_float

                except (ValueError, IndexError) as e:
                    # Skip malformed rows
                    continue

        print(f"  Loaded {len(adp_data)} player ADP values from FreshSheets")
        return adp_data

    except FileNotFoundError:
        print(f"  FreshSheets CSV not found at {csv_path}")
        return {}
    except Exception as e:
        print(f"  Error loading FreshSheets ADP: {e}")
        return {}

def get_sample_adp(adp_data: Dict[str, float], count: int = 10):
    """Show sample ADP data for verification."""
    print(f"\n  Sample ADP data:")
    for i, (player, adp) in enumerate(list(adp_data.items())[:count]):
        print(f"    {player}: {adp}")

if __name__ == "__main__":
    # Test loading ADP data
    adp_data = load_freshsheets_adp()

    if adp_data:
        print(f"✅ Successfully loaded {len(adp_data)} ADP values")
        get_sample_adp(adp_data)

        # Show some specific players
        players_to_check = ['Connor McDavid', 'Nathan MacKinnon', 'Nikita Kucherov']
        print(f"\n  Key players:")
        for player in players_to_check:
            if player in adp_data:
                print(f"    {player}: {adp_data[player]}")
            else:
                print(f"    {player}: NOT FOUND")
    else:
        print("❌ No ADP data loaded")
