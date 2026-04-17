"""
Load ADP data from FantasyPros CSV.
Current 2025-26 fantasy hockey ADP data.
"""

import csv
from typing import Dict

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
