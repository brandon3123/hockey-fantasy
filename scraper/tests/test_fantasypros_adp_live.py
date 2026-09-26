from scrape_fantasypros_adp import parse_adp_table, resolve_adp

# Shape mirrors the live page: name and team code share one cell, the ADP
# columns are Yahoo / ESPN / AVG.
FIXTURE = """
<html><body>
<table>
  <thead><tr><th>Rank</th><th>PlayerTeam</th><th>POS</th><th>Yahoo</th><th>ESPN</th><th>AVG</th></tr></thead>
  <tbody>
    <tr><td>1</td><td><a href="/nhl/players/nathan-mackinnon.php">Nathan MacKinnon</a><span>COL</span></td><td>C1</td><td>2</td><td>1</td><td>1.5</td></tr>
    <tr><td>2</td><td><a href="/nhl/players/connor-mcdavid.php">Connor McDavid</a><span>EDM</span></td><td>C2</td><td>1</td><td>2</td><td>1.5</td></tr>
    <tr><td>3</td><td><a href="/nhl/players/nikita-kucherov.php">Nikita Kucherov</a><span>TB</span></td><td>RW1</td><td>3</td><td>4</td><td>3.5</td></tr>
  </tbody>
</table>
<table>
  <thead><tr><th></th><th>Source</th><th>Site</th><th>Last Update</th></tr></thead>
  <tbody>
    <tr><td></td><td>ADP</td><td>Yahoo! Sports</td><td>9/20</td></tr>
  </tbody>
</table>
</body></html>
"""


def test_parses_averaged_adp_from_fixture():
    adp = parse_adp_table(FIXTURE)
    assert adp["Nathan MacKinnon"] == 1.5
    assert adp["Connor McDavid"] == 1.5
    assert adp["Nikita Kucherov"] == 3.5


def test_strips_trailing_team_code_from_name_cell():
    assert "COL" not in parse_adp_table(FIXTURE)


def test_keeps_whole_name_when_cell_has_no_team_code():
    html = (
        "<table><tr><td>7</td><td>Chris Kreider</td><td>LW1</td><td>9</td><td>8</td><td>8.5</td></tr></table>"
    )
    assert parse_adp_table(html) == {"Chris Kreider": 8.5}


def test_skips_rows_whose_rank_is_not_numeric():
    html = (
        "<table><tr><td>Rank</td><td>PlayerTeam</td><td>POS</td><td>Yahoo</td><td>ESPN</td><td>AVG</td></tr>"
        "<tr><td>1</td><td>Connor McDavidEDM</td><td>C1</td><td>1</td><td>2</td><td>1.5</td></tr></table>"
    )
    assert parse_adp_table(html) == {"Connor McDavid": 1.5}


def test_skips_rows_with_non_numeric_average():
    html = (
        "<table><tr><td>1</td><td>Connor McDavidEDM</td><td>C1</td><td>1</td><td>2</td><td>AVG.</td></tr></table>"
    )
    assert parse_adp_table(html) == {}


def test_returns_empty_for_page_without_adp_table():
    assert parse_adp_table("<html><body><h1>Fantasy Hockey</h1></body></html>") == {}


def test_resolve_adp_prefers_live_values():
    assert resolve_adp({"Connor McDavid": 1.5}, {"Connor McDavid": 99.0}) == {
        "Connor McDavid": 1.5
    }


def test_resolve_adp_falls_back_when_live_is_empty():
    assert resolve_adp({}, {"Connor McDavid": 99.0}) == {"Connor McDavid": 99.0}


def test_resolve_adp_returns_empty_when_both_empty():
    assert resolve_adp({}, {}) == {}
