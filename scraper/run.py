"""
Entry point for the Top Shelf Draft scraper.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from combine import combine_data, save_players_json, save_lines_json

def main():
    print("=" * 60)
    print("Top Shelf Draft Scraper")
    print("=" * 60)
    print()

    try:
        players, lines_data = combine_data()
        save_players_json(players)
        save_lines_json(lines_data)

        print()
        print("=" * 60)
        print("Scraping complete!")
        print("=" * 60)
        print(f"Total players: {len(players)}")
        print(f"Total line combinations: {len(lines_data)}")
        print(f"Output: app/public/players.json")
        print(f"Output: app/public/lines.json")
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
