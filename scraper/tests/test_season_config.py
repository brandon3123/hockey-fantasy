from datetime import date

import season_config
from season_config import current_nhl_season, nhl_season_code, parse_mode, rank_key


def test_nhl_season_code_from_int():
    assert nhl_season_code(2026) == "20262027"


def test_nhl_season_code_from_str():
    assert nhl_season_code("2025") == "20252026"


def test_current_nhl_season_july_or_later():
    assert current_nhl_season(date(2026, 9, 25)) == "20262027"


def test_current_nhl_season_before_july():
    assert current_nhl_season(date(2026, 2, 1)) == "20252026"


def test_parse_mode_variants():
    assert parse_mode("") == "regular"
    assert parse_mode("r") == "regular"
    assert parse_mode("Regular") == "regular"
    assert parse_mode("p") == "playoffs"
    assert parse_mode("PLAYOFFS") == "playoffs"


def test_parse_mode_invalid_defaults_to_regular(capsys):
    assert parse_mode("hockey") == "regular"
    assert "Unrecognized" in capsys.readouterr().out


def test_rank_key():
    assert rank_key("regular") == "projectedPoints"
    assert rank_key("playoffs") == "projectedPlayoffPoints"


def test_prompt_parses_inputs(monkeypatch):
    answers = iter(["2026", "p"])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))
    assert season_config.prompt_season_and_mode() == (2026, "20262027", "playoffs")


def test_prompt_defaults_to_current_season_and_regular(monkeypatch):
    answers = iter(["", ""])
    monkeypatch.setattr("builtins.input", lambda prompt="": next(answers))
    season_year, code, mode = season_config.prompt_season_and_mode()
    assert mode == "regular"
    assert code == season_config.current_nhl_season()
    assert season_year == int(code[:4])
