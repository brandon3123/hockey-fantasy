import scrape_rosters
from scrape_rosters import ALL_TEAMS, roster_teams


def test_regular_mode_scrapes_all_32_teams():
    assert roster_teams("regular") == ALL_TEAMS
    assert len(ALL_TEAMS) == 32


def test_playoffs_mode_uses_detection(monkeypatch):
    monkeypatch.setattr(scrape_rosters, "get_playoff_teams", lambda: ["TBL", "FLA"])
    assert roster_teams("playoffs") == ["TBL", "FLA"]
