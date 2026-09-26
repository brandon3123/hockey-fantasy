import combine


MONEYPUCK_PATHS = {
    "lines_regular.csv": "/tmp/lines_regular.csv",
    "lines_playoffs.csv": "/tmp/lines_playoffs.csv",
}

STALE_REGULAR = [{"name": "Tkachuk-Cozens-Giroux", "team": "OTT"}]
STALE_PLAYOFFS = [{"name": "PlayoffLine", "team": "FLA"}]
CURRENT_REGULAR = [{"name": "Barkov-Tkachuk-Reinhart", "team": "FLA"}]


def _patch_sources(monkeypatch, puckpedia_lines):
    monkeypatch.setattr(combine, "parse_lines_csv", lambda path: (
        STALE_PLAYOFFS if path and "playoffs" in path else STALE_REGULAR
    ))
    monkeypatch.setattr(combine, "scrape_puckpedia_lines", lambda rosters: puckpedia_lines)


def test_regular_mode_uses_puckpedia_lines(monkeypatch):
    _patch_sources(monkeypatch, CURRENT_REGULAR)
    lines = combine.load_line_data([], MONEYPUCK_PATHS, "regular")
    assert lines["regular"] == CURRENT_REGULAR


def test_regular_mode_falls_back_to_moneypuck_when_puckpedia_empty(monkeypatch):
    _patch_sources(monkeypatch, [])
    lines = combine.load_line_data([], MONEYPUCK_PATHS, "regular")
    assert lines["regular"] == STALE_REGULAR


def test_regular_mode_falls_back_when_puckpedia_raises(monkeypatch):
    monkeypatch.setattr(combine, "parse_lines_csv", lambda path: (
        STALE_PLAYOFFS if path and "playoffs" in path else STALE_REGULAR
    ))

    def boom(rosters):
        raise RuntimeError("Cloudflare challenge did not clear")

    monkeypatch.setattr(combine, "scrape_puckpedia_lines", boom)
    lines = combine.load_line_data([], MONEYPUCK_PATHS, "regular")
    assert lines["regular"] == STALE_REGULAR


def test_playoff_mode_never_uses_puckpedia(monkeypatch):
    def boom(rosters):
        raise AssertionError("PuckPedia must not be crawled in playoff mode")

    monkeypatch.setattr(combine, "parse_lines_csv", lambda path: (
        STALE_PLAYOFFS if path and "playoffs" in path else STALE_REGULAR
    ))
    monkeypatch.setattr(combine, "scrape_puckpedia_lines", boom)
    lines = combine.load_line_data([], MONEYPUCK_PATHS, "playoffs")
    assert lines["regular"] == STALE_REGULAR
    assert lines["playoffs"] == STALE_PLAYOFFS


def test_puckpedia_is_skipped_when_env_flag_is_set(monkeypatch):
    monkeypatch.setenv("SKIP_PUCKPEDIA_LINES", "1")
    monkeypatch.setattr(combine, "parse_lines_csv", lambda path: (
        STALE_PLAYOFFS if path and "playoffs" in path else STALE_REGULAR
    ))
    called = []
    monkeypatch.setattr(combine, "scrape_puckpedia_lines",
                        lambda rosters: called.append(rosters) or CURRENT_REGULAR)

    lines = combine.load_line_data([], MONEYPUCK_PATHS, "regular")
    assert called == [], "PuckPedia must not be crawled when skipped"
    assert lines["regular"] == STALE_REGULAR


def test_puckpedia_still_runs_when_env_flag_is_zero(monkeypatch):
    monkeypatch.setenv("SKIP_PUCKPEDIA_LINES", "0")
    _patch_sources(monkeypatch, CURRENT_REGULAR)
    assert combine.load_line_data([], MONEYPUCK_PATHS, "regular")["regular"] == CURRENT_REGULAR


def test_skip_flag_reads_common_truthy_values(monkeypatch):
    for value, expected in [("1", True), ("true", True), ("YES", True),
                            ("0", False), ("", False), ("no", False)]:
        monkeypatch.setenv("SKIP_PUCKPEDIA_LINES", value)
        assert combine.skip_puckpedia() is expected


def test_skip_flag_defaults_to_false(monkeypatch):
    monkeypatch.delenv("SKIP_PUCKPEDIA_LINES", raising=False)
    assert combine.skip_puckpedia() is False


def test_adp_prefers_live_scrape_over_manual_export(monkeypatch):
    monkeypatch.setattr(combine, "scrape_fantasypros_adp", lambda: {"Nikita Kucherov": 3.5})
    monkeypatch.setattr(combine, "load_fantasypros_ros", lambda: {"Nikita Kucherov": 99.0})
    assert combine.load_adp_data() == {"Nikita Kucherov": 3.5}


def test_adp_falls_back_to_ros_export_when_live_scrape_empty(monkeypatch):
    monkeypatch.setattr(combine, "scrape_fantasypros_adp", lambda: {})
    monkeypatch.setattr(combine, "load_fantasypros_ros", lambda: {"Nikita Kucherov": 99.0})
    assert combine.load_adp_data() == {"Nikita Kucherov": 99.0}
