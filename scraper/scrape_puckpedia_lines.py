"""
Scrape PuckPedia depth charts to rebuild current line combinations.

MoneyPuck's line-combo CSVs only refresh once games have been played, so a
pre-season run hands back last season's lines (a Florida player can end up
matched to an Ottawa unit). PuckPedia's player pages carry a live depth
chart instead - "LW1 / 1st Line" - which we group by team and lineup number
to rebuild lines and pairings for the current roster.

Access needs Playwright driving the installed Chrome: Cloudflare bounces the
bundled headless Chromium but lets real Chrome through. Results are cached
for CACHE_MAX_AGE_DAYS so the crawl is a once-a-week cost, not a per-run one.
"""

import json
import os
import re
import time
import unicodedata
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(SCRIPT_DIR, "puckpedia", "depth_chart_cache.json")
STATUS_PATH = os.path.join(SCRIPT_DIR, "puckpedia", "crawl_status.json")
BASE_URL = "https://puckpedia.com"
USER_AGENT = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
CACHE_MAX_AGE_DAYS = 7
REQUEST_DELAY_SECONDS = 2.0
PAGE_TIMEOUT_MS = 20000
CHALLENGE_TIMEOUT_S = 40

# A depth-chart row renders as three adjacent lines: "LW1", "DEPTH CHART", "1st Line".
DEPTH_CHART_RE = re.compile(
    r"([A-Z]{1,2}\d+)\s*[|\s]\s*DEPTH CHART\s*[|\s]\s*([^|\n]{1,24})"
)
SLOT_RE = re.compile(r"^([A-Z]{1,2})(\d+)$")

FORWARD_SIDES = ("C", "LW", "RW")
# Left-defence before right-defence is the conventional pairing order.
SIDE_ORDER = {"C": 0, "LW": 1, "RW": 2, "D": 3, "LD": 3, "RD": 4}
GOALIE_SIDES = ("G",)


def build_slug(name: str) -> str:
    """PuckPedia player URL slug for a full name ("Tomáš Hertl" -> "tomas-hertl")."""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    # Apostrophes and initials' periods vanish rather than becoming separators.
    cleaned = re.sub(r"[.'’]", "", ascii_name.lower())
    slug = re.sub(r"[^a-z0-9]+", "-", cleaned)
    return slug.strip("-")


def last_name(name: str) -> str:
    """Surname only - the app's line names are hyphen-joined surnames."""
    parts = name.strip().split()
    return parts[-1] if parts else name


def parse_depth_chart(page_text: str) -> Optional[Dict[str, str]]:
    """Pull {"slot", "line"} out of a player page's text, or None if absent."""
    match = DEPTH_CHART_RE.search(page_text or "")
    if not match:
        return None
    return {"slot": match.group(1), "line": match.group(2).strip()}


def parse_slot(slot: str) -> Optional[Tuple[str, int]]:
    """Split a depth-chart slot into (side, lineup number); None for goalies/junk.

    "LW1" -> ("LW", 1), "RD1" -> ("D", 1), "G1" -> None.
    """
    match = SLOT_RE.match((slot or "").strip())
    if not match:
        return None
    side, number = match.group(1), int(match.group(2))
    if side in GOALIE_SIDES:
        return None
    if side in ("LD", "RD"):
        side = "D"
    return side, number


def build_lines(depth_charts: Dict[str, Dict], rosters: List[Dict]) -> List[Dict]:
    """Group depth-chart slots into lines/pairings in the app's lines schema.

    Grouping is keyed on (team, unit, lineup number), so a player can only ever
    match a unit belonging to his own team - the bug that showed Brady Tkachuk
    an Ottawa line. Goalies and lone players are dropped.
    """
    groups: Dict[Tuple[str, str, int], List[Tuple[str, str, Optional[str]]]] = {}

    for player in rosters:
        name = player.get("name")
        team = player.get("team")
        entry = depth_charts.get(name) if name else None
        if not entry or not team:
            continue
        parsed = parse_slot(entry.get("slot", ""))
        if parsed is None:
            continue
        side, number = parsed
        unit = "F" if side in FORWARD_SIDES else "D"
        # Keep the raw side (LD/RD) so pairings order left-defence first.
        letters = re.match(r"^[A-Z]+", entry.get("slot", "").strip())
        raw_side = letters.group(0) if letters else side
        groups.setdefault((team, unit, number), []).append(
            (raw_side or side, name, entry.get("line"))
        )

    lines = []
    for (team, unit, number), members in groups.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda member: SIDE_ORDER.get(member[0], 9))
        surnames = [last_name(name) for _, name, _ in members]
        label = next((label for _, _, label in members if label), None)
        lines.append({
            "lineId": f"{team}-{unit}{number}-" + "-".join(surnames),
            "team": team,
            "name": "-".join(surnames),
            "position": "pairing" if unit == "D" else "line",
            "situation": "5on5",
            # Pre-season: nothing played, so ice time is 0 and ordering comes
            # from line_number (the app sorts on icetime first).
            "icetime": 0,
            "games_played": 0,
            "line_number": number,
            "metrics": {},
            "line_label": label,
            "source": "puckpedia",
        })

    # Top line first within each team: forward lines before pairings, then by
    # lineup number. getTopLine() in the app takes a team's first line.
    lines.sort(key=lambda line: (line["team"], line["line_number"],
                                 0 if line["position"] == "line" else 1, line["name"]))
    return lines


def select_lines(puckpedia_lines: List[Dict], moneypuck_lines: List[Dict]) -> List[Dict]:
    """Prefer PuckPedia lines; fall back to MoneyPuck when PuckPedia yields none."""
    return puckpedia_lines or moneypuck_lines


def is_cache_fresh(fetched: Optional[str], max_age_days: int = CACHE_MAX_AGE_DAYS) -> bool:
    """True when a YYYY-MM-DD cache stamp is within max_age_days of today."""
    if not fetched:
        return False
    try:
        stamp = datetime.strptime(fetched, "%Y-%m-%d").date()
    except ValueError:
        return False
    return date.today() - stamp <= timedelta(days=max_age_days)


def load_cache(cache_path: str = CACHE_PATH) -> Dict:
    """Read the depth-chart cache; an unreadable cache is simply empty."""
    try:
        with open(cache_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"fetched": None, "players": {}}
    if not isinstance(data, dict):
        return {"fetched": None, "players": {}}
    data.setdefault("fetched", None)
    data.setdefault("players", {})
    return data


def save_cache(cache: Dict, cache_path: str = CACHE_PATH) -> None:
    """Persist the depth-chart cache, creating its directory if needed."""
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as handle:
        json.dump(cache, handle, indent=2, sort_keys=True)


class PlayerPageMissing(Exception):
    """PuckPedia has no page for this player (HTTP 404/410)."""


def should_retry_page(status: Optional[int]) -> bool:
    """Whether a fetch failure is worth retrying.

    A 404 will still be a 404 on the next attempt, and waiting out the timeout
    three times over is what makes the crawl crawl. Anything else (Cloudflare
    interstitial, slow response, unknown status) gets a retry.
    """
    return status not in (404, 410)


def _wait_for_challenge(page) -> None:
    """PuckPedia sits behind a Cloudflare interstitial that clears itself."""
    deadline = time.time() + CHALLENGE_TIMEOUT_S
    while "moment" in page.title().lower():
        if time.time() > deadline:
            raise RuntimeError("Cloudflare challenge did not clear")
        page.wait_for_timeout(2000)


def _fetch_page_text(page, slug: str) -> str:
    response = page.goto(f"{BASE_URL}/player/{slug}", wait_until="domcontentloaded",
                         timeout=PAGE_TIMEOUT_MS)
    status = response.status if response is not None else None
    if not should_retry_page(status):
        # Bail before waiting out the timeout: the page will never exist.
        raise PlayerPageMissing(f"{slug}: HTTP {status}")
    page.wait_for_function(
        "() => document.body && document.body.innerText.includes('DEPTH CHART')",
        timeout=PAGE_TIMEOUT_MS,
    )
    return page.evaluate("document.body.innerText")


def _write_status(index: int, total: int, found: int, status_path: str = STATUS_PATH) -> None:
    """Publish crawl progress so it can be read while the crawl is running."""
    try:
        with open(status_path, "w", encoding="utf-8") as handle:
            json.dump({"index": index, "total": total, "found": found,
                       "updated": time.strftime("%H:%M:%S")}, handle)
    except OSError:
        pass


def _print_progress(index: int, total: int, found: int, started: float, misses: int) -> None:
    """One-line progress bar: percentage, counts, rate and ETA."""
    fraction = index / total if total else 0.0
    filled = int(fraction * 28)
    elapsed = max(time.time() - started, 0.001)
    rate = index / elapsed
    eta_minutes = (total - index) / rate / 60 if rate else 0.0
    bar = "#" * filled + "-" * (28 - filled)
    print(f"\r  [{bar}] {fraction * 100:5.1f}%  {index}/{total} players  "
          f"{found} charts  {misses} misses  {rate:.2f}/s  ETA {eta_minutes:4.1f}m",
          end="", flush=True)


def fetch_depth_charts(names: List[str], delay: float = REQUEST_DELAY_SECONDS,
                       checkpoint=None, checkpoint_every: int = 50) -> Dict[str, Dict]:
    """Crawl PuckPedia player pages and return {name: {slot, line}}.

    Transient failures (the Cloudflare interstitial, a slow response) get two
    retries; a 404 is accepted immediately as "this player has no page".
    `checkpoint` is called with everything gathered so far every
    `checkpoint_every` players, so a long crawl is not lost to a crash.
    """
    from playwright.sync_api import sync_playwright

    found: Dict[str, Dict] = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(user_agent=USER_AGENT,
                                      viewport={"width": 1280, "height": 900})
        page = context.new_page()
        try:
            page.goto(f"{BASE_URL}/lineups", wait_until="domcontentloaded",
                      timeout=PAGE_TIMEOUT_MS)
        except Exception as exc:  # noqa: BLE001 - interstitial may outlast the timeout
            print(f"    Note: initial load slow ({str(exc)[:40]})")
        _wait_for_challenge(page)

        total = len(names)
        started = time.time()
        misses = 0
        for index, name in enumerate(names, start=1):
            slug = build_slug(name)
            entry = None
            for attempt in range(3):
                try:
                    entry = parse_depth_chart(_fetch_page_text(page, slug))
                    break
                except PlayerPageMissing:
                    break  # no page for this player; retrying cannot help
                except Exception:  # noqa: BLE001 - transient nav/timeout failure
                    if attempt < 2:
                        page.wait_for_timeout(5000)
            if entry:
                found[name] = entry
            else:
                misses += 1
                print(f"\n    No depth chart for {name} ({slug})", flush=True)
            if entry:
                found[name] = entry
            _print_progress(index, total, len(found), started, misses)
            if index % 10 == 0:
                _write_status(index, total, len(found))
            if checkpoint and index % checkpoint_every == 0:
                checkpoint(dict(found))
            page.wait_for_timeout(int(delay * 1000))

        print(flush=True)
        browser.close()
    return found


def scrape_puckpedia_lines(rosters: List[Dict], cache_path: str = CACHE_PATH) -> List[Dict]:
    """Current line combinations for the given rosters, from PuckPedia.

    Cached depth charts are reused for CACHE_MAX_AGE_DAYS; only uncached skaters
    are crawled. Returns [] (rather than raising) when PuckPedia is unreachable,
    so the caller can fall back to the MoneyPuck CSVs.
    """
    skaters = [player for player in rosters if player.get("position") != "G"]
    names = sorted({player["name"] for player in skaters if player.get("name")})

    cache = load_cache(cache_path)
    if is_cache_fresh(cache.get("fetched")):
        known = dict(cache.get("players", {}))
    else:
        known = {}
    missing = [name for name in names if name not in known]

    print(f"  PuckPedia depth charts: {len(known)} cached, {len(missing)} to fetch")
    if missing:
        def checkpoint(entries: Dict[str, Dict]) -> None:
            save_cache({"fetched": date.today().isoformat(),
                        "players": {**known, **entries}}, cache_path)

        try:
            known.update(fetch_depth_charts(missing, checkpoint=checkpoint))
        except Exception as exc:  # noqa: BLE001 - network/browser failure
            print(f"    Warning: PuckPedia fetch failed ({exc}); keeping cached charts")
        save_cache({"fetched": date.today().isoformat(), "players": known}, cache_path)

    lines = build_lines(known, rosters)
    print(f"    Built {len(lines)} lines/pairings from PuckPedia depth charts")
    return lines


if __name__ == "__main__":
    from scrape_rosters import scrape_rosters

    rosters = scrape_rosters("20252026", "regular")
    for line in scrape_puckpedia_lines(rosters)[:20]:
        print(f"  {line['team']}  {line['name']}  ({line['line_label']})")
