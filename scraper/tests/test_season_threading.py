import scrape_moneypuck
from season_config import current_nhl_season


def test_scrape_player_stats_threads_season(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        scrape_moneypuck, "scrape_all_player_stats",
        lambda season: captured.update(season=season) or {},
    )
    scrape_moneypuck.scrape_player_stats("20262027")
    assert captured["season"] == "20262027"


def test_scrape_player_stats_defaults_to_current_season(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        scrape_moneypuck, "scrape_all_player_stats",
        lambda season: captured.update(season=season) or {},
    )
    scrape_moneypuck.scrape_player_stats()
    assert captured["season"] == current_nhl_season()


def test_generate_stats_for_player_threads_season_to_game_log(monkeypatch):
    monkeypatch.setattr(
        scrape_moneypuck, "TOP_PLAYER_STATS",
        {"Test Player": {"games": 80, "goals": 40, "assists": 50, "ppg": 1.125}},
    )
    monkeypatch.setattr(
        scrape_moneypuck, "get_player_id_from_name", lambda name, team: 123
    )
    captured = {}
    monkeypatch.setattr(
        scrape_moneypuck, "scrape_player_game_log",
        lambda player_id, season: captured.update(season=season) or None,
    )
    scrape_moneypuck.generate_stats_for_player("Test Player", "TBL", "C", season="20262027")
    assert captured["season"] == "20262027"
