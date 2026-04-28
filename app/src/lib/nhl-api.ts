const NHL_API_BASE = "https://api.nhl.com/api/v1";

export interface TonightGame {
  gameId: number;
  away: string;
  home: string;
  time: string;
}

export interface PlayerGameResult {
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  goals: number;
  assists: number;
}

function formatTimeET(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

interface ScheduleGame {
  gamePk: number;
  status: {
    abstractGameState: string;
  };
  teams: {
    away: { abbreviation: string };
    home: { abbreviation: string };
  };
  gameDate: string;
}

interface ScheduleResponse {
  dates: {
    games: ScheduleGame[];
  }[];
}

function mapGame(game: ScheduleGame): TonightGame {
  return {
    gameId: game.gamePk,
    away: game.teams.away.abbreviation,
    home: game.teams.home.abbreviation,
    time: formatTimeET(game.gameDate),
  };
}

export async function fetchScheduleGames(
  date: string
): Promise<TonightGame[]> {
  const url = `${NHL_API_BASE}/schedule?date=${date}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NHL schedule API error: ${res.status}`);
  }
  const data: ScheduleResponse = await res.json();

  if (!data.dates || data.dates.length === 0) return [];

  return data.dates[0].games.map(mapGame);
}

export async function fetchCompletedGames(
  date: string
): Promise<TonightGame[]> {
  const url = `${NHL_API_BASE}/schedule?date=${date}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NHL schedule API error: ${res.status}`);
  }
  const data: ScheduleResponse = await res.json();

  if (!data.dates || data.dates.length === 0) return [];

  return data.dates[0].games
    .filter((game) => game.status.abstractGameState === "Final")
    .map(mapGame);
}

interface BoxscorePlayer {
  person: {
    id: number;
    fullName: string;
  };
  stats: {
    skaterStats?: {
      goals: number;
      assists: number;
    };
  };
}

interface BoxscoreTeamSide {
  team: {
    abbreviation: string;
  };
  players: Record<string, BoxscorePlayer>;
}

interface BoxscoreResponse {
  teams: {
    away: BoxscoreTeamSide;
    home: BoxscoreTeamSide;
  };
}

export async function fetchGameResults(
  gameId: number
): Promise<PlayerGameResult[]> {
  const url = `${NHL_API_BASE}/game/${gameId}/boxscore`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NHL boxscore API error: ${res.status}`);
  }
  const data: BoxscoreResponse = await res.json();

  const results: PlayerGameResult[] = [];

  const sides = [
    { side: data.teams.away, opponent: data.teams.home.team.abbreviation },
    { side: data.teams.home, opponent: data.teams.away.team.abbreviation },
  ];

  for (const { side, opponent } of sides) {
    const teamAbbr = side.team.abbreviation;
    for (const player of Object.values(side.players)) {
      const stats = player.stats?.skaterStats;
      if (!stats) continue;
      const { goals, assists } = stats;
      if (goals === 0 && assists === 0) continue;

      results.push({
        playerId: String(player.person.id),
        playerName: player.person.fullName,
        team: teamAbbr,
        opponent,
        goals,
        assists,
      });
    }
  }

  return results;
}

export async function fetchTonightGames(): Promise<TonightGame[]> {
  const today = new Date().toISOString().slice(0, 10);
  return fetchScheduleGames(today);
}
