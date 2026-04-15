import { DraftPick, DraftState, Player } from '@/types/player';

export interface DraftConfig {
  managers: number;
  yourPosition: number;
  playersPerTeam: number;
}

export function calculateSnakePick(
  round: number,
  managers: number
): number[] {
  const isReverseRound = round % 2 === 0;
  const order: number[] = [];

  for (let i = 1; i <= managers; i++) {
    order.push(isReverseRound ? managers - i + 1 : i);
  }

  return order;
}

export function getCurrentPickNumber(state: DraftState): number {
  return (state.currentRound - 1) * state.managers + state.currentPick;
}

export function getCurrentManager(state: DraftState): number {
  const order = calculateSnakePick(state.currentRound, state.managers);
  return order[state.currentPick - 1];
}

export function advanceDraft(state: DraftState): DraftState {
  const totalPicks = state.managers * state.playersPerTeam;
  const currentPickNum = getCurrentPickNumber(state);

  if (currentPickNum >= totalPicks) {
    return { ...state, currentPick: 0 };
  }

  let newRound = state.currentRound;
  let newPick = state.currentPick + 1;

  if (newPick > state.managers) {
    newRound += 1;
    newPick = 1;
  }

  return {
    ...state,
    currentRound: newRound,
    currentPick: newPick,
  };
}

export function assignPlayerToManager(
  state: DraftState,
  playerId: string,
  playerName: string
): DraftState {
  const currentManager = getCurrentManager(state);

  const newPick: DraftPick = {
    playerId,
    playerName,
    round: state.currentRound,
    managerIndex: currentManager - 1,
  };

  const newState = advanceDraft(state);

  return {
    ...newState,
    picks: [...state.picks, newPick],
    availablePlayers: state.availablePlayers.filter(
      p => p.name !== playerName
    ),
  };
}

export function getManagerPicks(state: DraftState, managerIndex: number): DraftPick[] {
  return state.picks.filter(p => p.managerIndex === managerIndex);
}

export function getTeamStackScore(state: DraftState, team: string): number {
  const yourPicks = getManagerPicks(state, state.yourPosition - 1);
  return yourPicks.filter(p => {
    const player = state.availablePlayers.find(ap => ap.name === p.playerName);
    return 0; // Placeholder
  }).length;
}

export function calculateDraftGrade(state: DraftState): string {
  return 'B'; // Placeholder
}

export function initializeDraft(config: DraftConfig, players: Player[]): DraftState {
  return {
    managers: config.managers,
    yourPosition: config.yourPosition,
    playersPerTeam: config.playersPerTeam,
    currentRound: 1,
    currentPick: 1,
    picks: [],
    availablePlayers: [...players],
  };
}
