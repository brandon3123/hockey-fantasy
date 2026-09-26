from scrape_puckpedia_lines import (
    build_lines,
    build_slug,
    is_cache_fresh,
    last_name,
    parse_depth_chart,
    parse_slot,
    select_lines,
)

# A realistic slice of a PuckPedia player page's innerText.
PLAYER_PAGE_TEXT = """
Skip to main content
BRADY TKACHUK
OVERVIEW
CONTRACTS
Brady Tkachuk
#
8
AGE
27
POS
LW
SHOT
L
H
6'4"
W
212lbs
LW1
DEPTH CHART
1st Line
CURRENT CONTRACT
CAP HIT
$8,205,714
"""

# Same page for a defenceman.
DEFENCE_PAGE_TEXT = """
Roman Josi
POS
D
RD1
DEPTH CHART
1st Pairing
CURRENT CONTRACT
"""


def test_build_slug_lowercases_and_hyphenates():
    assert build_slug("Brady Tkachuk") == "brady-tkachuk"


def test_build_slug_strips_accents():
    assert build_slug("Tomáš Hertl") == "tomas-hertl"


def test_build_slug_drops_initials_punctuation():
    assert build_slug("P.J. Brown") == "pj-brown"


def test_build_slug_drops_apostrophes():
    assert build_slug("Ryan O'Reilly") == "ryan-oreilly"


def test_build_slug_collapses_repeated_separators():
    assert build_slug("  Adam   Fox  ") == "adam-fox"


def test_last_name_returns_final_token():
    assert last_name("Brady Tkachuk") == "Tkachuk"
    assert last_name("Nathan MacKinnon") == "MacKinnon"


def test_parse_depth_chart_reads_slot_and_line():
    assert parse_depth_chart(PLAYER_PAGE_TEXT) == {"slot": "LW1", "line": "1st Line"}


def test_parse_depth_chart_reads_defenceman_pairing():
    assert parse_depth_chart(DEFENCE_PAGE_TEXT) == {"slot": "RD1", "line": "1st Pairing"}


def test_parse_depth_chart_returns_none_when_marker_absent():
    assert parse_depth_chart("Brady Tkachuk\nPOS\nLW\n") is None


def test_parse_slot_splits_side_and_number():
    assert parse_slot("LW1") == ("LW", 1)
    assert parse_slot("C12") == ("C", 12)


def test_parse_slot_maps_defence_sides_to_one_group():
    assert parse_slot("RD1") == ("D", 1)
    assert parse_slot("LD3") == ("D", 3)


def test_parse_slot_rejects_goalies_and_junk():
    assert parse_slot("G1") is None
    assert parse_slot("") is None
    assert parse_slot("LW") is None


def test_build_lines_groups_three_forwards_into_one_line():
    depth = {
        "Aleksander Barkov": {"slot": "C1", "line": "1st Line"},
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
        "Sam Reinhart": {"slot": "RW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Aleksander Barkov", "team": "FLA", "position": "C"},
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
        {"name": "Sam Reinhart", "team": "FLA", "position": "RW"},
    ]
    lines = build_lines(depth, rosters)
    assert len(lines) == 1
    assert lines[0]["name"] == "Barkov-Tkachuk-Reinhart"
    assert lines[0]["position"] == "line"
    assert lines[0]["situation"] == "5on5"


def test_build_lines_never_merges_teams():
    # Same slot number on two teams: they must not combine into one line.
    depth = {
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
        "Sam Reinhart": {"slot": "RW1", "line": "1st Line"},
        "Connor McDavid": {"slot": "LW1", "line": "1st Line"},
        "Leon Draisaitl": {"slot": "RW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
        {"name": "Sam Reinhart", "team": "FLA", "position": "RW"},
        {"name": "Connor McDavid", "team": "EDM", "position": "C"},
        {"name": "Leon Draisaitl", "team": "EDM", "position": "C"},
    ]
    lines = build_lines(depth, rosters)
    assert sorted(line["name"] for line in lines) == [
        "McDavid-Draisaitl",
        "Tkachuk-Reinhart",
    ]


def test_build_lines_drops_one_player_groups():
    # A lone player is not a line; without a partner there is nothing to show.
    depth = {"Brady Tkachuk": {"slot": "LW1", "line": "1st Line"}}
    rosters = [{"name": "Brady Tkachuk", "team": "FLA", "position": "LW"}]
    assert build_lines(depth, rosters) == []


def test_build_lines_keeps_forwards_and_defence_apart():
    # A C1 and a D1 are different units even though both are "number 1".
    depth = {
        "Aleksander Barkov": {"slot": "C1", "line": "1st Line"},
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
        "Aaron Ekblad": {"slot": "RD1", "line": "1st Pairing"},
        "Nate Schmidt": {"slot": "LD1", "line": "1st Pairing"},
    }
    rosters = [
        {"name": "Aleksander Barkov", "team": "FLA", "position": "C"},
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
        {"name": "Aaron Ekblad", "team": "FLA", "position": "D"},
        {"name": "Nate Schmidt", "team": "FLA", "position": "D"},
    ]
    lines = build_lines(depth, rosters)
    # Schmidt is LD1, Ekblad is RD1: left-defence is listed first.
    assert sorted(line["name"] for line in lines) == ["Barkov-Tkachuk", "Schmidt-Ekblad"]


def test_build_lines_pairs_two_defencemen():
    depth = {
        "Noah Hanifin": {"slot": "LD1", "line": "1st Pairing"},
        "Shea Theodore": {"slot": "RD1", "line": "1st Pairing"},
    }
    rosters = [
        {"name": "Noah Hanifin", "team": "VGK", "position": "D"},
        {"name": "Shea Theodore", "team": "VGK", "position": "D"},
    ]
    lines = build_lines(depth, rosters)
    assert len(lines) == 1
    # Left-defence is listed first.
    assert lines[0]["name"] == "Hanifin-Theodore"
    assert lines[0]["position"] == "pairing"


def test_build_lines_skips_players_without_depth_chart_entry():
    depth = {
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
        "Sam Reinhart": {"slot": "RW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
        {"name": "Sam Reinhart", "team": "FLA", "position": "RW"},
        {"name": "Uvis Balinskis", "team": "FLA", "position": "D"},
    ]
    lines = build_lines(depth, rosters)
    assert [line["name"] for line in lines] == ["Tkachuk-Reinhart"]


def test_build_lines_ignores_goalies():
    depth = {
        "Andrei Vasilevskiy": {"slot": "G1", "line": "Goalie"},
        "Connor McDavid": {"slot": "C1", "line": "1st Line"},
        "Leon Draisaitl": {"slot": "LW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Andrei Vasilevskiy", "team": "TB", "position": "G"},
        {"name": "Connor McDavid", "team": "EDM", "position": "C"},
        {"name": "Leon Draisaitl", "team": "EDM", "position": "C"},
    ]
    lines = build_lines(depth, rosters)
    assert [line["name"] for line in lines] == ["McDavid-Draisaitl"]


def test_build_lines_emits_the_fields_the_app_reads():
    depth = {
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
        "Sam Reinhart": {"slot": "RW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
        {"name": "Sam Reinhart", "team": "FLA", "position": "RW"},
    ]
    line = build_lines(depth, rosters)[0]
    for key in ("lineId", "team", "name", "position", "situation", "icetime",
                "games_played", "metrics"):
        assert key in line
    assert line["team"] == "FLA"
    assert line["games_played"] == 0


def test_build_lines_is_deterministic():
    depth = {
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
        "Sam Reinhart": {"slot": "RW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
        {"name": "Sam Reinhart", "team": "FLA", "position": "RW"},
    ]
    assert build_lines(depth, rosters) == build_lines(depth, rosters)


def test_build_lines_records_lineup_number():
    depth = {
        "Aleksander Barkov": {"slot": "C1", "line": "1st Line"},
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Aleksander Barkov", "team": "FLA", "position": "C"},
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
    ]
    assert build_lines(depth, rosters)[0]["line_number"] == 1


def test_build_lines_orders_top_line_first():
    # The app's "top line" helper takes the first line of a team, so forward
    # lines must come before pairings, lowest lineup number first. Surnames are
    # chosen so alphabetical order would give a different answer.
    depth = {
        "William Karlsson": {"slot": "C1", "line": "1st Line"},
        "Ivan Barbashev": {"slot": "LW1", "line": "1st Line"},
        "Chandler Stephenson": {"slot": "C2", "line": "2nd Line"},
        "Brett Howden": {"slot": "LW2", "line": "2nd Line"},
        "Noah Hanifin": {"slot": "LD1", "line": "1st Pairing"},
        "Shea Theodore": {"slot": "RD1", "line": "1st Pairing"},
    }
    rosters = [
        {"name": "William Karlsson", "team": "VGK", "position": "C"},
        {"name": "Ivan Barbashev", "team": "VGK", "position": "LW"},
        {"name": "Chandler Stephenson", "team": "VGK", "position": "C"},
        {"name": "Brett Howden", "team": "VGK", "position": "C"},
        {"name": "Noah Hanifin", "team": "VGK", "position": "D"},
        {"name": "Shea Theodore", "team": "VGK", "position": "D"},
    ]
    lines = build_lines(depth, rosters)
    assert [line["name"] for line in lines] == [
        "Karlsson-Barbashev",
        "Hanifin-Theodore",
        "Stephenson-Howden",
    ]


def test_build_lines_emits_zero_icetime_for_the_apps_top_line_sort():
    depth = {
        "Brady Tkachuk": {"slot": "LW1", "line": "1st Line"},
        "Sam Reinhart": {"slot": "RW1", "line": "1st Line"},
    }
    rosters = [
        {"name": "Brady Tkachuk", "team": "FLA", "position": "LW"},
        {"name": "Sam Reinhart", "team": "FLA", "position": "RW"},
    ]
    assert build_lines(depth, rosters)[0]["icetime"] == 0


def test_cache_round_trips_depth_charts(tmp_path):
    from scrape_puckpedia_lines import load_cache, save_cache

    path = str(tmp_path / "nested" / "cache.json")
    save_cache({"fetched": "2026-09-25", "players": {"Brady Tkachuk": {"slot": "LW1", "line": "1st Line"}}}, path)
    assert load_cache(path) == {
        "fetched": "2026-09-25",
        "players": {"Brady Tkachuk": {"slot": "LW1", "line": "1st Line"}},
    }


def test_load_cache_treats_missing_file_as_empty(tmp_path):
    from scrape_puckpedia_lines import load_cache

    assert load_cache(str(tmp_path / "nope.json")) == {"fetched": None, "players": {}}


def test_load_cache_treats_corrupt_file_as_empty(tmp_path):
    from scrape_puckpedia_lines import load_cache

    path = tmp_path / "cache.json"
    path.write_text("{not json", encoding="utf-8")
    assert load_cache(str(path)) == {"fetched": None, "players": {}}


def test_missing_page_status_is_not_retried():
    # Retrying a 404 costs three timeouts for a page that will never exist;
    # fringe skaters with no PuckPedia page are the bulk of the misses.
    from scrape_puckpedia_lines import should_retry_page

    assert should_retry_page(404) is False
    assert should_retry_page(410) is False


def test_live_or_unknown_status_is_retried():
    from scrape_puckpedia_lines import should_retry_page

    assert should_retry_page(200) is True
    assert should_retry_page(403) is True  # Cloudflare interstitial
    assert should_retry_page(None) is True  # timed out, status unknown


def test_select_lines_prefers_puckpedia_lines():
    assert select_lines([{"name": "Tkachuk-Barkov"}], [{"name": "stale"}]) == [
        {"name": "Tkachuk-Barkov"}
    ]


def test_select_lines_falls_back_to_moneypuck_when_puckpedia_empty():
    assert select_lines([], [{"name": "stale"}]) == [{"name": "stale"}]


def test_is_cache_fresh_within_max_age():
    assert is_cache_fresh("2026-09-25", max_age_days=7) is True


def test_is_cache_stale_past_max_age():
    assert is_cache_fresh("2026-01-01", max_age_days=7) is False


def test_is_cache_stale_when_missing():
    assert is_cache_fresh(None, max_age_days=7) is False
