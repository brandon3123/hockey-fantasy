"""End-to-end check that build_players attaches an ADP to an accented name.

build_players is the only place the `adp` field is set, so the unit tests on
the normalizer are not enough on their own - this exercises the real merge.
"""

from combine import build_players


def _roster(name, team="OTT", position="LW"):
    return {
        "name": name,
        "team": team,
        "position": position,
        "injury": {"status": None, "expectedReturn": None, "description": None},
    }


def _build(rosters, adp):
    return {
        p["name"]: p
        for p in build_players(
            rosters=rosters,
            player_stats={},
            team_odds={},
            ros_data=adp,
            mode="regular",
            season="20262027",
            is_preseason=True,
            preseason_points={},
            prev_season_stats={},
        )
    }


def test_accented_player_receives_its_adp():
    players = _build(
        [_roster("Tim Stützle")],
        {"Tim Stutzle": 8.5},
    )
    assert players["Tim Stützle"]["adp"] == 8.5


def test_slafkovsky_receives_its_adp():
    players = _build(
        [_roster("Juraj Slafkovský")],
        {"Juraj Slafkovsky": 12.0},
    )
    assert players["Juraj Slafkovský"]["adp"] == 12.0


def test_lafreniere_receives_its_adp():
    players = _build(
        [_roster("Alexis Lafrenière")],
        {"Alexis Lafreniere": 31.5},
    )
    assert players["Alexis Lafrenière"]["adp"] == 31.5


def test_unlisted_player_still_gets_none():
    # Brady Skjei has no overall ADP on FantasyPros, so this must stay None
    # rather than picking up a number from some other player.
    players = _build([_roster("Brady Skjei")], {"Tim Stutzle": 8.5})
    assert players["Brady Skjei"]["adp"] is None


def test_plain_name_still_matches():
    players = _build([_roster("Connor McDavid")], {"Connor McDavid": 1.5})
    assert players["Connor McDavid"]["adp"] == 1.5


def test_hyphenated_name_does_not_steal_a_different_players_adp():
    # Normalization drops punctuation but keeps spaces, so "Player-Two" becomes
    # "playertwo" while "Player Two" stays "player two". They stay distinct,
    # which is the safe outcome: a wrong ADP is worse than a missing one.
    players = _build(
        [_roster("Player-Two", position="D")],
        {"Player Two": 40.0},
    )
    assert players["Player-Two"]["adp"] is None


def test_accents_still_match_when_only_the_adp_side_has_them():
    # The reverse direction too - some sources keep the accent and some do not,
    # so neither side can be assumed to be the plain one.
    players = _build([_roster("Tim Stutzle")], {"Tim Stützle": 8.5})
    assert players["Tim Stutzle"]["adp"] == 8.5
