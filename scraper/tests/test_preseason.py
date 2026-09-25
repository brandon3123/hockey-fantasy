from preseason import preseason_player_fields, resolve_preseason_projection


def test_resolve_prefers_fantasypros():
    preseason_points = {"Nathan MacKinnon": 112.0}
    prev = {"Nathan MacKinnon": {"goals": 53, "assists": 74, "points": 127}}
    assert resolve_preseason_projection("Nathan MacKinnon", preseason_points, prev) == 112.0


def test_resolve_falls_back_to_prev_season_points():
    prev = {"Nathan MacKinnon": {"goals": 53, "assists": 74, "points": 127}}
    assert resolve_preseason_projection("Nathan MacKinnon", {}, prev) == 127.0


def test_resolve_falls_back_when_points_key_missing():
    prev = {"Nathan MacKinnon": {"goals": 53, "assists": 74}}
    assert resolve_preseason_projection("Nathan MacKinnon", {}, prev) == 127.0


def test_resolve_zero_projection_beats_prev_season():
    assert resolve_preseason_projection("X", {"X": 0.0}, {"X": {"points": 100}}) == 0.0


def test_resolve_returns_none_when_no_data():
    assert resolve_preseason_projection("Anyone Else", {}, {}) is None


def test_preseason_fields():
    fields = preseason_player_fields(110.0)
    assert fields["goals"] == 0
    assert fields["assists"] == 0
    assert fields["games"] == 0
    assert fields["ppg"] == 1.34
    assert fields["projected_points"] == 110.0
    assert fields["games_remaining"] == 82


def test_preseason_fields_zero_projection():
    fields = preseason_player_fields(0.0)
    assert fields["ppg"] == 0.0
    assert fields["projected_points"] == 0.0
    assert fields["games_remaining"] == 82
