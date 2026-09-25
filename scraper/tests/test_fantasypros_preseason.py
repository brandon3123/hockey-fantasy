from scrape_fantasypros_preseason import _points_column_index, parse_preseason_points

FIXTURE = """
<html><body>
<table class="ranking-table">
  <thead><tr><th>RK</th><th>PLAYER NAME</th><th>TEAM</th><th>POS</th><th>PROJ. PTS</th><th>AVG.</th></tr></thead>
  <tbody>
    <tr><td>1</td><td class="player"><a href="/nhl/players/nathan-mackinnon.php">Nathan MacKinnon</a></td><td>COL</td><td>C1</td><td>112.3</td><td>1.0</td></tr>
    <tr><td>2</td><td class="player"><a href="/nhl/players/connor-mcdavid.php">Connor McDavid</a></td><td>EDM</td><td>C2</td><td>108.9</td><td>2.0</td></tr>
    <tr><td>3</td><td class="player"><a href="/nhl/players/no-points.php">No Points</a></td><td>CHI</td><td>C3</td><td>&mdash;</td><td>3.0</td></tr>
  </tbody>
</table>
</body></html>
"""


def test_points_column_index():
    assert _points_column_index(["RK", "PLAYER NAME", "TEAM", "POS", "PROJ. PTS"]) == 4
    assert _points_column_index(["RK", "PLAYER NAME", "PTS"]) == 2
    assert _points_column_index(["RK", "PLAYER NAME", "PROJ"]) == -1
    assert _points_column_index(["RK", "PLAYER NAME", "AVG."]) == -1


def test_parses_projected_points_from_fixture():
    points = parse_preseason_points(FIXTURE)
    assert points == {"Nathan MacKinnon": 112.3, "Connor McDavid": 108.9}


def test_skips_rows_without_numeric_points():
    # 'No Points' row has an em-dash in the points column -> excluded
    assert "No Points" not in parse_preseason_points(FIXTURE)


def test_returns_empty_when_no_points_column():
    html = (
        "<table><thead><tr><th>RK</th><th>PLAYER NAME</th><th>AVG.</th></tr></thead>"
        "<tbody><tr><td>1</td><td><a>Nathan MacKinnon</a></td><td>1.0</td></tr></tbody></table>"
    )
    assert parse_preseason_points(html) == {}


def test_returns_empty_for_dormant_shell_page():
    assert parse_preseason_points("<html><body><h1>Fantasy Hockey Articles</h1></body></html>") == {}
