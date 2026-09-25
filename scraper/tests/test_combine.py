from combine import build_players, resolve_stats


def make_roster(name, team="TBL", position="C"):
    return {"name": name, "team": team, "position": position,
            "injury": {"status": "healthy", "expectedReturn": None}}


ODDS = {
    "TBL": {"round1": 0.8, "round2": 0.4, "round3": 0.2, "round4": 0.1},
    "CHI": {"round1": 0.5, "round2": 0.2, "round3": 0.1, "round4": 0.05},
}


def test_regular_preseason_uses_fantasypros_projection():
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
        preseason_points={"Nikita Kucherov": 110.0},
    )
    p = players[0]
    assert p["regularSeasonGoals"] == 0
    assert p["regularSeasonAssists"] == 0
    assert p["gamesPlayed"] == 0
    assert p["projectedPoints"] == 110.0
    assert p["pointsPerGame"] == round(110.0 / 82, 2)
    assert p["gamesRemaining"] == 82
    assert p["rank"] == 1


def test_regular_preseason_falls_back_to_prev_season_points():
    prev = {"Nikita Kucherov": {"goals": 44, "assists": 86, "points": 130, "games": 82, "ppg": 1.59}}
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
        preseason_points={}, prev_season_stats=prev,
    )
    assert players[0]["projectedPoints"] == 130.0


def test_regular_preseason_zero_projection_when_no_data():
    players = build_players(
        [make_roster("Rookie McRookieface")], player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
    )
    assert players[0]["projectedPoints"] == 0.0
    assert players[0]["pointsPerGame"] == 0.0


def test_regular_inseason_uses_rest_of_season_math():
    stats = {"Nikita Kucherov": {"name": "Nikita Kucherov", "team": "TBL", "position": "RW",
                                 "goals": 40, "assists": 50, "games": 41, "points": 90, "ppg": 2.2}}
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats=stats, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=False,
    )
    p = players[0]
    assert p["regularSeasonGoals"] == 40
    assert p["regularSeasonAssists"] == 50
    assert p["gamesPlayed"] == 41
    assert p["gamesRemaining"] == 41
    assert p["projectedPoints"] == round(2.2 * 41, 1)


def test_regular_ranks_by_projected_points():
    rosters = [make_roster("Low Proj", "CHI"), make_roster("High Proj", "TBL")]
    preseason_points = {"High Proj": 100.0, "Low Proj": 50.0}
    players = build_players(
        rosters, player_stats={}, team_odds={}, ros_data={},
        mode="regular", season="20262027", is_preseason=True,
        preseason_points=preseason_points,
    )
    assert [p["name"] for p in players] == ["High Proj", "Low Proj"]


def test_playoffs_ranks_by_projected_playoff_points():
    stats = {
        "TBL Star": {"name": "TBL Star", "team": "TBL", "position": "C",
                     "goals": 40, "assists": 50, "games": 82, "points": 90, "ppg": 1.1},
        "CHI Star": {"name": "CHI Star", "team": "CHI", "position": "C",
                     "goals": 40, "assists": 50, "games": 82, "points": 90, "ppg": 1.1},
    }
    rosters = [make_roster("CHI Star", "CHI"), make_roster("TBL Star", "TBL")]
    players = build_players(
        rosters, player_stats=stats, team_odds=ODDS, ros_data={},
        mode="playoffs", season="20262027", is_preseason=False,
    )
    assert players[0]["name"] == "TBL Star"  # deeper playoff run -> more projected playoff points
    assert players[0]["rank"] == 1


def test_playoff_points_use_odds():
    stats = {"Nikita Kucherov": {"name": "Nikita Kucherov", "team": "TBL", "position": "RW",
                                 "goals": 44, "assists": 86, "games": 82, "points": 130, "ppg": 1.59}}
    players = build_players(
        [make_roster("Nikita Kucherov")], player_stats=stats, team_odds=ODDS, ros_data={},
        mode="regular", season="20262027", is_preseason=False,
    )
    p = players[0]
    expected_games = 7 * (0.8 + 0.4 + 0.2 + 0.1)
    assert p["projectedPlayoffGames"] == round(expected_games, 1)
    assert p["projectedPlayoffPoints"] == round(1.59 * expected_games, 1)


def test_resolve_stats_exact_then_case_insensitive():
    stats = {"nikita kucherov": {"goals": 44, "team": "TBL"}}
    assert resolve_stats("Nikita Kucherov", "TBL", stats) == {"goals": 44, "team": "TBL"}
    assert resolve_stats("Someone Else", "TBL", stats) == {}


def test_resolve_stats_prefers_name_and_team_match():
    stats = {
        "Same Name": {"team": "TBL", "goals": 1},
        "Other Name": {"team": "CHI", "goals": 2},
    }
    # exact key exists for 'Same Name' with team CHI in roster: name+team mismatch -> keep exact-key stats
    assert resolve_stats("Same Name", "CHI", stats) == {"team": "TBL", "goals": 1}
