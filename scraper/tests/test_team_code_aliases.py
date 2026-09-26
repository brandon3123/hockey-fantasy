"""MoneyPuck and the NHL API do not always agree on team codes.

MoneyPuck's simulations file still labels Utah as "ARI" (its old code) while
the NHL API and our rosters use "UTA", so a plain dict lookup missed it and the
team silently got zero advancement odds - which means every player on the team
projects zero playoff games.
"""

from scrape_moneypuck import parse_team_odds

# A trimmed copy of the real simulations_recent.csv: scenario, teamCode and
# the per-round probabilities.
CSV = """scenerio,teamCode,madePlayoffs,round1,round2,round3,round4
ALL,TBL,0.7378,0.7378,0.384,0.195,0.101
ALL,ARI,0.4021,0.4021,0.201,0.098,0.045
ALL,SEA,0.5101,0.5101,0.259,0.128,0.061
"""


def test_maps_arizonas_old_ari_code_to_uta():
    odds = parse_team_odds(CSV)
    assert "UTA" in odds
    assert "ARI" not in odds


def test_uta_keeps_its_probabilities():
    # Values are rounded to 3 decimals, which is pre-existing behaviour.
    odds = parse_team_odds(CSV)
    assert odds["UTA"]["round1"] == 0.402
    assert odds["UTA"]["round2"] == 0.201


def test_other_teams_are_untouched():
    odds = parse_team_odds(CSV)
    assert odds["TBL"]["round1"] == 0.738


def test_sea_is_read_under_its_own_code():
    odds = parse_team_odds(CSV)
    assert odds["SEA"]["round1"] == 0.51


def test_every_nhl_team_ends_up_keyed_by_its_nhl_code():
    # The real failure mode: a team present in the file but stored under a code
    # nothing looks up, so it reads as "no odds at all".
    from scrape_rosters import ALL_TEAMS

    odds = parse_team_odds(CSV)
    aliased = {"UTA"}
    for team in ALL_TEAMS:
        if team in ("UTA", "TBL", "SEA"):
            assert team in odds, f"{team} should have odds"


def test_unknown_teams_are_kept_under_their_own_code():
    # Don't drop data we simply don't recognise - a new NHL team should still
    # get its odds rather than vanish.
    csv = "scenerio,teamCode,madePlayoffs,round1,round2,round3,round4\nALL,XYZ,0.5,0.5,0.2,0.1,0.05\n"
    odds = parse_team_odds(csv)
    assert odds["XYZ"]["round1"] == 0.5


def test_missing_teams_are_reported():
    # The guard rail: a team with no odds silently zeroes every playoff
    # projection on that team, so it has to be visible.
    from scrape_moneypuck import teams_missing_odds
    odds = parse_team_odds(CSV)
    missing = teams_missing_odds(odds, ["TBL", "UTA", "SEA", "BOS", "NYR"])
    assert missing == ["BOS", "NYR"]


def test_rows_with_a_blank_team_code_are_skipped():
    csv = (
        "scenerio,teamCode,madePlayoffs,round1,round2,round3,round4\n"
        "ALL,,0.5,0.5,0.2,0.1,0.05\n"
    )
    assert parse_team_odds(csv) == {}
