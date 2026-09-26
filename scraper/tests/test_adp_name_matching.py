from scrape_fantasypros_adp import (
    build_adp_index,
    lookup_adp,
    normalize_player_name,
)

# FantasyPros strips accents from names; the NHL API keeps them. Comparing the
# raw strings loses the ADP for every accented player, including top-10 picks
# like Tim Stützle.


def test_normalize_strips_accents():
    assert normalize_player_name("Tim Stützle") == "tim stutzle"


def test_normalize_strips_accents_from_slafkovsky():
    assert normalize_player_name("Juraj Slafkovský") == "juraj slafkovsky"


def test_normalize_leaves_plain_names_unchanged():
    assert normalize_player_name("Connor McDavid") == "connor mcdavid"


def test_normalize_folds_case():
    assert normalize_player_name("TIM STUTZLE") == "tim stutzle"


def test_normalize_drops_punctuation():
    assert normalize_player_name("Ryan O'Reilly") == "ryan oreilly"


def test_normalize_keeps_hyphenated_names_readable():
    # Deduplicating the separator would be wrong: "Lafreniere" vs "Laferniere"
    # are different players, so punctuation is dropped rather than collapsed.
    assert normalize_player_name("Neal Pionk") == "neal pionk"


def test_index_is_keyed_by_normalized_name():
    index = build_adp_index({"Tim Stutzle": 8.5})
    assert index == {"tim stutzle": 8.5}


def test_lookup_matches_accented_roster_name_against_plain_adp_key():
    # The real failure: FantasyPros has "Tim Stutzle", the roster has
    # "Tim Stützle", and the ADP was being dropped.
    index = build_adp_index({"Tim Stutzle": 8.5})
    assert lookup_adp(index, "Tim Stützle") == 8.5


def test_lookup_matches_slafkovsky():
    index = build_adp_index({"Juraj Slafkovsky": 12.0})
    assert lookup_adp(index, "Juraj Slafkovský") == 12.0


def test_lookup_matches_lafreniere():
    index = build_adp_index({"Alexis Lafreniere": 31.5})
    assert lookup_adp(index, "Alexis Lafrenière") == 31.5


def test_lookup_still_finds_an_exact_name():
    index = build_adp_index({"Connor McDavid": 1.5})
    assert lookup_adp(index, "Connor McDavid") == 1.5


def test_lookup_returns_none_when_the_player_is_not_listed():
    index = build_adp_index({"Connor McDavid": 1.5})
    assert lookup_adp(index, "Brady Skjei") is None


def test_lookup_handles_an_empty_index():
    assert lookup_adp({}, "Tim Stützle") is None


def test_index_of_empty_dict_is_empty():
    assert build_adp_index({}) == {}
