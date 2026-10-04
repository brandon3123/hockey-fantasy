const NHL_API_BASE = "https://api-web.nhle.com";

export interface TonightGame {
  gameId: number;
  away: string;
  home: string;
  awayLogo: string;
  homeLogo: string;
  time: string;
  gameState: string;
  awayScore?: number;
  homeScore?: number;
}

export interface PlayerGameResult {
  gameId: number;
  nhlId: number;
  playerName: string;
  team: string;
  opponent: string;
  goals: number;
  assists: number;
  positionCode: string;
}

export interface RosterPlayer {
  nhlId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  team: string;
  position: string;
}

function formatTimeMT(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
    timeZoneName: "short",
  });
}

function getDateForTimezone(tz: string = 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
}

interface ScheduleGame {
  id: number;
  startTimeUTC: string;
  gameState: string;
  awayTeam: { abbrev: string; logo: string; score?: number };
  homeTeam: { abbrev: string; logo: string; score?: number };
}

interface ScheduleResponse {
  gameWeek: { date: string; games: ScheduleGame[] }[];
}

interface BoxscoreTeamStats {
  forwards: BoxscorePlayer[];
  // The boxscore has used both keys for the defense group across seasons.
  defensemen?: BoxscorePlayer[];
  defense?: BoxscorePlayer[];
  goalies: BoxscorePlayer[];
}

interface BoxscorePlayer {
  playerId: number;
  name: { default: string };
  goals: number;
  assists: number;
  positionCode: string | null;
}

interface BoxscoreResponse {
  awayTeam: { abbrev: string };
  homeTeam: { abbrev: string };
  playerByGameStats: {
    awayTeam: BoxscoreTeamStats;
    homeTeam: BoxscoreTeamStats;
  };
}

interface RosterApiResponse {
  forwards: {
    id: number;
    firstName: { default: string };
    lastName: { default: string };
    positionCode: string;
  }[];
  defensemen: {
    id: number;
    firstName: { default: string };
    lastName: { default: string };
    positionCode: string;
  }[];
  goalies: {
    id: number;
    firstName: { default: string };
    lastName: { default: string };
    positionCode: string;
  }[];
}

interface EspnInjuryAthlete {
  displayName: string;
}

interface EspnInjuryEntry {
  status: string;
  shortComment: string;
  date: string;
  athlete: EspnInjuryAthlete;
}

interface EspnInjuryTeam {
  displayName: string;
  injuries: EspnInjuryEntry[];
}

interface EspnInjuriesResponse {
  injuries: EspnInjuryTeam[];
}

export interface InjuryInfo {
  status: "healthy" | "day-to-day" | "week-to-week" | "out indefinitely" | "out for playoffs";
  description: string | null;
}

let espnInjuriesCache: { data: Map<string, InjuryInfo>; timestamp: number } | null = null;
const ESPN_INJURIES_TTL = 10 * 60 * 1000;

let playoffTeamsCache: { data: Set<string>; timestamp: number } | null = null;
const PLAYOFF_TEAMS_TTL = 30 * 60 * 1000;

function mapGame(game: ScheduleGame): TonightGame {
  return {
    gameId: game.id,
    away: game.awayTeam.abbrev,
    home: game.homeTeam.abbrev,
    awayLogo: game.awayTeam.logo,
    homeLogo: game.homeTeam.logo,
    time: formatTimeMT(game.startTimeUTC),
    gameState: game.gameState,
    awayScore: game.awayTeam.score,
    homeScore: game.homeTeam.score,
  };
}

export async function fetchScheduleByDate(
  date: string
): Promise<TonightGame[]> {
  const url = `${NHL_API_BASE}/v1/schedule/${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NHL schedule API error: ${res.status}`);
  const data: ScheduleResponse = await res.json();

  const day = data.gameWeek?.find((d) => d.date === date);
  if (!day) return [];
  return day.games.map(mapGame);
}

export async function fetchCompletedGames(
  date: string
): Promise<TonightGame[]> {
  const games = await fetchScheduleByDate(date);
  // api-web marks finished games FINAL (the deprecated stats API used OFF).
  return games.filter((g) => g.gameState === "OFF" || g.gameState === "FINAL");
}

export async function fetchTonightGames(timezone: string = 'America/Denver'): Promise<TonightGame[]> {
  // "Tonight" is computed in the requested zone (the app's audience is
  // Mountain; the schedule day boundary must match the wall clock users see).
  const todayTz = getDateForTimezone(timezone);
  try {
    const res = await fetch(`${NHL_API_BASE}/v1/schedule/now`);
    if (!res.ok) return fetchScheduleByDate(todayTz);
    const data: ScheduleResponse = await res.json();
    // No fallback to "the next day with games": showing future games as
    // tonight is exactly the bug this avoids. Empty means empty.
    const day = data.gameWeek?.find((d) => d.date === todayTz);
    return day ? day.games.map(mapGame) : [];
  } catch {
    return fetchScheduleByDate(todayTz);
  }
}

export async function fetchGameResults(
  gameId: number
): Promise<PlayerGameResult[]> {
  const url = `${NHL_API_BASE}/v1/gamecenter/${gameId}/boxscore`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NHL boxscore API error: ${res.status}`);
  const data: BoxscoreResponse = await res.json();

  const results: PlayerGameResult[] = [];
  const away = data.awayTeam.abbrev;
  const home = data.homeTeam.abbrev;

  const sides = [
    { stats: data.playerByGameStats.awayTeam, team: away, opponent: home },
    { stats: data.playerByGameStats.homeTeam, team: home, opponent: away },
  ];

  for (const { stats, team, opponent } of sides) {
    // The defense group has been keyed both "defensemen" and "defense" across
    // API versions — read both, deduped, or every defenseman vanishes.
    const seenIds = new Set<number>();
    for (const group of ["forwards", "defensemen", "defense", "goalies"] as const) {
      for (const player of stats[group] ?? []) {
        if (seenIds.has(player.playerId)) continue;
        seenIds.add(player.playerId);
        if (player.goals === 0 && player.assists === 0) continue;
        results.push({
          gameId,
          nhlId: player.playerId,
          playerName: player.name.default,
          team,
          opponent,
          goals: player.goals,
          assists: player.assists,
          positionCode: player.positionCode ?? "",
        });
      }
    }
  }

  return results;
}

export async function fetchTeamRoster(
  teamAbbrev: string,
  season?: string
): Promise<RosterPlayer[]> {
  const s = season ?? getCurrentSeason();
  const url = `${NHL_API_BASE}/v1/roster/${teamAbbrev}/${s}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: RosterApiResponse = await res.json();

  const players: RosterPlayer[] = [];
  for (const pos of ["forwards", "defensemen", "goalies"] as const) {
    for (const p of data[pos] ?? []) {
      const firstName = p.firstName?.default ?? "";
      const lastName = p.lastName?.default ?? "";
      players.push({
        nhlId: p.id,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        team: teamAbbrev,
        position: p.positionCode,
      });
    }
  }
  return players;
}

export async function buildNhlIdToPlayerMap(
  teamAbbrevs: string[]
): Promise<Map<number, { name: string; isDefenseman: boolean }>> {
  const playerMap = new Map<number, { name: string; isDefenseman: boolean }>();
  for (const team of teamAbbrevs) {
    const players = await fetchTeamRoster(team);
    for (const p of players) {
      playerMap.set(p.nhlId, { name: p.fullName, isDefenseman: p.position === "D" });
    }
  }
  return playerMap;
}

/**
 * The scorer of the game-winning goal, resolved from the landing endpoint's
 * chronological goal list: the winning team's (loser goals + 1)th goal.
 * Shootout-decided games have no such goal (the SO winner isn't a goal stat)
 * and return null.
 */
export async function fetchGameWinningGoalScorer(gameId: number): Promise<number | null> {
  const res = await fetch(`${NHL_API_BASE}/v1/gamecenter/${gameId}/landing`);
  if (!res.ok) return null;
  const data = await res.json();
  const periods = data?.summary?.scoring ?? [];

  const goals: Array<{ team: string; playerId: number }> = [];
  for (const period of periods) {
    for (const g of period.goals ?? []) {
      const team = g.teamAbbrev?.default ?? "";
      if (!team || !g.playerId) continue;
      goals.push({ team, playerId: g.playerId });
    }
  }

  const count = (team: string) => goals.filter(g => g.team === team).length;
  const winner = count("away") > count("home")
    ? (goals.find(g => g.team === "away")?.team ?? null)
    : (goals.find(g => g.team === "home")?.team ?? null);
  if (!winner) return null;

  const loserGoals = count(winner === "away" ? "home" : "away");
  let winnerGoals = 0;
  for (const g of goals) {
    if (g.team !== winner) continue;
    winnerGoals += 1;
    if (winnerGoals === loserGoals + 1) return g.playerId;
  }
  return null;
}

export async function fetchEspnInjuries(): Promise<Map<string, InjuryInfo>> {
  if (espnInjuriesCache && Date.now() - espnInjuriesCache.timestamp < ESPN_INJURIES_TTL) {
    return espnInjuriesCache.data;
  }

  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries");
    if (!res.ok) throw new Error(`ESPN injuries API error: ${res.status}`);
    const data: EspnInjuriesResponse = await res.json();

    const injuryMap = new Map<string, InjuryInfo>();

    for (const team of data.injuries || []) {
      for (const injury of team.injuries || []) {
        const statusCol = injury.status;
        const comment = injury.shortComment || null;
        const playerName = injury.athlete?.displayName;
        if (!playerName) continue;

        let injuryStatus: InjuryInfo["status"] = "week-to-week";
        if (statusCol === "Day-To-Day") {
          injuryStatus = "day-to-day";
        } else if (statusCol === "Injured Reserve") {
          injuryStatus = "out indefinitely";
        } else if (statusCol === "Out") {
          injuryStatus = "out indefinitely";
        }

        injuryMap.set(playerName.toLowerCase(), {
          status: injuryStatus,
          description: comment,
        });
      }
    }

    espnInjuriesCache = { data: injuryMap, timestamp: Date.now() };
    return injuryMap;
  } catch {
    return espnInjuriesCache?.data ?? new Map();
  }
}

export async function fetchActivePlayoffTeams(): Promise<Set<string>> {
  if (playoffTeamsCache && Date.now() - playoffTeamsCache.timestamp < PLAYOFF_TEAMS_TTL) {
    return playoffTeamsCache.data;
  }

  try {
    const res = await fetch("https://api-web.nhle.com/v1/playoff-bracket/2026");
    if (!res.ok) throw new Error(`NHL bracket API error: ${res.status}`);
    const data = await res.json();

    const allTeams = new Set<string>();
    const eliminatedTeams = new Set<string>();
    for (const series of data.series || []) {
      const top = series.topSeedTeam;
      const bottom = series.bottomSeedTeam;
      const topAbbrev = top?.abbrev;
      const bottomAbbrev = bottom?.abbrev;
      const topId = top?.id;
      const bottomId = bottom?.id;
      const winner = series.winningTeamId;
      const loser = series.losingTeamId;

      if (topAbbrev && topAbbrev !== "TBD") allTeams.add(topAbbrev);
      if (bottomAbbrev && bottomAbbrev !== "TBD") allTeams.add(bottomAbbrev);

      if (winner && loser) {
        if (topId === loser && topAbbrev) eliminatedTeams.add(topAbbrev);
        if (bottomId === loser && bottomAbbrev) eliminatedTeams.add(bottomAbbrev);
      }
    }

    const activeTeams = new Set<string>();
    for (const team of allTeams) {
      if (!eliminatedTeams.has(team)) activeTeams.add(team);
    }

    playoffTeamsCache = { data: activeTeams, timestamp: Date.now() };
    return activeTeams;
  } catch {
    return playoffTeamsCache?.data ?? new Set();
  }
}
