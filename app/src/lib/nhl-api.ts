const NHL_API_BASE = "https://api-web.nhle.com";

export interface TonightGame {
  gameId: number;
  away: string;
  home: string;
  awayLogo: string;
  homeLogo: string;
  time: string;
  gameState: string;
}

export interface PlayerGameResult {
  nhlId: number;
  playerName: string;
  team: string;
  opponent: string;
  goals: number;
  assists: number;
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

function getDateET(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
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
  defensemen: BoxscorePlayer[];
  goalies: BoxscorePlayer[];
}

interface BoxscorePlayer {
  playerId: number;
  name: { default: string };
  goals: number;
  assists: number;
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

function mapGame(game: ScheduleGame): TonightGame {
  return {
    gameId: game.id,
    away: game.awayTeam.abbrev,
    home: game.homeTeam.abbrev,
    awayLogo: game.awayTeam.logo,
    homeLogo: game.homeTeam.logo,
    time: formatTimeMT(game.startTimeUTC),
    gameState: game.gameState,
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
  return games.filter((g) => g.gameState === "OFF");
}

export async function fetchTonightGames(): Promise<TonightGame[]> {
  const todayET = getDateET();
  try {
    const res = await fetch(`${NHL_API_BASE}/v1/schedule/now`);
    if (!res.ok) return fetchScheduleByDate(todayET);
    const data: ScheduleResponse = await res.json();
    const day = data.gameWeek?.find((d) => d.date === todayET);
    if (!day || day.games.length === 0) {
      for (const d of data.gameWeek ?? []) {
        if (d.games.length > 0) return d.games.map(mapGame);
      }
      return [];
    }
    return day.games.map(mapGame);
  } catch {
    return fetchScheduleByDate(todayET);
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
    for (const pos of ["forwards", "defensemen", "goalies"] as const) {
      for (const player of stats[pos] ?? []) {
        if (player.goals === 0 && player.assists === 0) continue;
        results.push({
          nhlId: player.playerId,
          playerName: player.name.default,
          team,
          opponent,
          goals: player.goals,
          assists: player.assists,
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

export async function buildNhlIdToNameMap(
  teamAbbrevs: string[]
): Promise<Map<number, string>> {
  const nameMap = new Map<number, string>();
  for (const team of teamAbbrevs) {
    const players = await fetchTeamRoster(team);
    for (const p of players) {
      nameMap.set(p.nhlId, p.fullName);
    }
  }
  return nameMap;
}
