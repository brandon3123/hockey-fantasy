"""
Entry point for the hockey fantasy scraper.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from combine import combine_data, save_players_json

def main():
    print("=" * 60)
    print("Hockey Fantasy Playoff Draft Scraper")
    print("=" * 60)
    print()

    try:
        players = combine_data()
        save_players_json(players)

        print()
        print("=" * 60)
        print("Scraping complete!")
        print("=" * 60)
        print(f"Total players: {len(players)}")
        print(f"Output: app/public/players.json")
        print()
        print("Run the app with:")
        print("  cd app && npm run dev")

    except Exception as e:
        print()
        print("ERROR: Scraping failed")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
