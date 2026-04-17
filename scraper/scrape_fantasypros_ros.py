"""
Load ROS data from FantasyPros CSV.
Rest of Season rankings - much better than ADP for playoff drafts.
"""

import csv
from typing import Dict

import os as _os
_SCRIPT_DIR = _os.path.dirname(_os.path.abspath(__file__))

def load_fantasypros_ros(csv_path: str = None) -> Dict[str, float]:
    if csv_path is None:
        csv_path = _os.path.join(_SCRIPT_DIR, "fantasy-pros", "ros.csv")
    """
    Load ROS data from FantasyPros CSV.

    Args:
        csv_path: Path to FantasyPros ros.csv file

    Returns:
        Dict mapping player name -> ROS rank value
    """
    ros_data = {}

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)

            # Skip header row
            next(reader, None)

            # Column indices (0-based):
            # B=1: PLAYER NAME, G=6: AVG. (ROS rank), H=7: STD.DEV
            for row in reader:
                if len(row) < 7:
                    continue

                try:
                    # Extract player name (column B, index 1)
                    player_name = row[1].strip()

                    # Extract ROS average (column G, index 6) - not STD.DEV!
                    ros_value = row[6].strip()

                    # Skip if no player name or invalid ROS
                    if not player_name or not ros_value or ros_value == 'AVG.':
                        continue

                    # Convert ROS to float
                    ros_float = float(ros_value)

                    # Store player ROS rank
                    ros_data[player_name] = ros_float

                except (ValueError, IndexError) as e:
                    # Skip malformed rows
                    continue

        print(f"  Loaded {len(ros_data)} player ROS values from FantasyPros")
        return ros_data

    except FileNotFoundError:
        print(f"  FantasyPros ROS CSV not found at {csv_path}")
        return {}
    except Exception as e:
        print(f"  Error loading FantasyPros ROS: {e}")
        return {}

def get_sample_ros(ros_data: Dict[str, float], count: int = 10):
    """Show sample ROS data for verification."""
    print(f"\n  Sample FantasyPros ROS data:")
    # Sort by ROS value (lower = better)
    sorted_players = sorted(ros_data.items(), key=lambda x: x[1])
    for player, ros in sorted_players[:count]:
        print(f"    {ros}. {player}")

if __name__ == "__main__":
    # Test loading ROS data
    ros_data = load_fantasypros_ros()

    if ros_data:
        print(f"✅ Successfully loaded {len(ros_data)} ROS values")
        get_sample_ros(ros_data)

        # Show some specific players
        players_to_check = ['Connor McDavid', 'Nathan MacKinnon', 'Nikita Kucherov']
        print(f"\n  Key players FantasyPros ROS:")
        for player in players_to_check:
            if player in ros_data:
                print(f"    {player}: {ros_data[player]}")
            else:
                print(f"    {player}: NOT FOUND")
    else:
        print("❌ No ROS data loaded")
