/**
 * Team-pick entries: the 32 NHL teams as pickable rows when a draft has
 * team_picks_enabled. They ride the normal pick flow — the API's uniqueness
 * and one-per-manager guards apply unchanged.
 */
import { isTeamPick, teamAbbrevFromPick } from '@/lib/scoring';

export const TEAM_PICK_POSITION = 'TEAM';

export interface TeamPickEntry {
  playerId: string;
  playerName: string;
  team: string;
  position: typeof TEAM_PICK_POSITION;
  displayPoints: 0;
  displayGames: 0;
}

const TEAMS: Array<[string, string]> = [
  ['ANA', 'Anaheim Ducks'], ['BOS', 'Boston Bruins'], ['BUF', 'Buffalo Sabres'],
  ['CGY', 'Calgary Flames'], ['CAR', 'Carolina Hurricanes'], ['CBJ', 'Columbus Blue Jackets'],
  ['CHI', 'Chicago Blackhawks'], ['COL', 'Colorado Avalanche'], ['DAL', 'Dallas Stars'],
  ['DET', 'Detroit Red Wings'], ['EDM', 'Edmonton Oilers'], ['FLA', 'Florida Panthers'],
  ['LAK', 'Los Angeles Kings'], ['MIN', 'Minnesota Wild'], ['MTL', 'Montreal Canadiens'],
  ['NJD', 'New Jersey Devils'], ['NSH', 'Nashville Predators'], ['NYI', 'New York Islanders'],
  ['NYR', 'New York Rangers'], ['OTT', 'Ottawa Senators'], ['PHI', 'Philadelphia Flyers'],
  ['PIT', 'Pittsburgh Penguins'], ['SEA', 'Seattle Kraken'], ['SJS', 'San Jose Sharks'],
  ['STL', 'St. Louis Blues'], ['TBL', 'Tampa Bay Lightning'], ['TOR', 'Toronto Maple Leafs'],
  ['UTA', 'Utah Mammoth'], ['VAN', 'Vancouver Canucks'], ['VGK', 'Vegas Golden Knights'],
  ['WPG', 'Winnipeg Jets'], ['WSH', 'Washington Capitals'],
];

/** The 32 team entries, in division-ish alphabetical order by abbrev. */
export function teamPickEntries(): TeamPickEntry[] {
  return TEAMS.map(([abbrev, name]) => ({
    playerId: `team-${abbrev.toLowerCase()}`,
    playerName: name,
    team: abbrev,
    position: TEAM_PICK_POSITION,
    displayPoints: 0,
    displayGames: 0,
  }));
}

/** True when a pick id is a team pick (re-exported for surface convenience). */
export { isTeamPick, teamAbbrevFromPick };
