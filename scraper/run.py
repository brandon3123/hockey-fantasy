"""
Entry point for the hockey fantasy scraper.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from combine import combine_data, save_players_json, save_lines_json, save_rankings_json

def main():
    print("=" * 60)
    print("Hockey Fantasy Playoff Draft Scraper")
    print("=" * 60)
    print()

    try:
        players, lines_data, rankings_data = combine_data()
        save_players_json(players)
        save_lines_json(lines_data)
        save_rankings_json(rankings_data)

        print()
        print("=" * 60)
        print("Scraping complete!")
        print("=" * 60)
        print(f"Total players: {len(players)}")
        print(f"Total line combinations: {len(lines_data)}")
        print(f"Total team rankings: {len(rankings_data)}")
        print(f"Output: app/public/{{players,lines,rankings}}.json")
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
