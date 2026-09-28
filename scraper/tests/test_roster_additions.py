"""Manual roster additions: players the NHL roster API omits.

The roster endpoint only lists players currently on the active roster; a
player starting the season on IR (or with a contract listing quirk) vanishes
from the draft board entirely. These entries keep them draftable.
"""

from scrape_rosters import apply_roster_additions


def test_adds_a_missing_player_with_injury_shape():
    rosters = [{"name": "Existing Guy", "team": "TOR", "position": "C", "injury": {"status": "healthy", "expectedReturn": None}}]
    additions = [{"name": "Connor Bedard", "team": "CHI", "position": "C"}]

    merged = apply_roster_additions(rosters, additions)

    assert any(p["name"] == "Connor Bedard" and p["team"] == "CHI" for p in merged)
    bedard = next(p for p in merged if p["name"] == "Connor Bedard")
    assert bedard["injury"] == {"status": "healthy", "expectedReturn": None}


def test_does_not_duplicate_an_already_present_player():
    rosters = [{"name": "Connor Bedard", "team": "CHI", "position": "C", "injury": {"status": "healthy", "expectedReturn": None}}]
    additions = [{"name": "Connor Bedard", "team": "CHI", "position": "C"}]

    merged = apply_roster_additions(rosters, additions)

    assert len([p for p in merged if p["name"] == "Connor Bedard"]) == 1


def test_merge_is_case_insensitive_on_name():
    rosters = [{"name": "connor bedard", "team": "CHI", "position": "C", "injury": {"status": "healthy", "expectedReturn": None}}]
    additions = [{"name": "Connor Bedard", "team": "CHI", "position": "C"}]

    merged = apply_roster_additions(rosters, additions)

    assert len([p for p in merged if "bedard" in p["name"].lower()]) == 1
