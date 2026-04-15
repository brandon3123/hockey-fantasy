export interface Player {
  name: string;
  team: string;
  position: "C" | "LW" | "RW" | "D";
  regularSeasonGoals: number;
  regularSeasonAssists: number;
  gamesPlayed: number;
  pointsPerGame: number;
  last10Games?: {
    goals: number;
    assists: number;
    points: number;
    games: number;
  };
  last20Games?: {
    goals: number;
    assists: number;
    points: number;
    games: number;
  };
  teamAdvancementOdds: {
    round1: number;
    round2: number;
    round3: number;
    round4: number;
  };
  projectedPlayoffGames: number;
  projectedPlayoffPoints: number;
  rank: number;
  adp?: number;
  injury: {
    status: "healthy" | "day-to-day" | "week-to-week" | "out indefinitely" | "out for playoffs";
    expectedReturn: string | null;
  };
}

export interface DraftPick {
  playerId: string;
  playerName: string;
  round: number;
  managerIndex: number;
}

export interface DraftState {
  managers: number;
  yourPosition: number;
  playersPerTeam: number;
  currentRound: number;
  currentPick: number;
  picks: DraftPick[];
  availablePlayers: Player[];
}
