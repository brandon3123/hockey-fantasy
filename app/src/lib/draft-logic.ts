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
    participantId: `manager-${currentManager - 1}`,
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

export function getParticipantPicks(state: DraftState, participantId: string): DraftPick[] {
  return state.picks.filter(p => p.participantId === participantId);
}

export function getManagerPicks(state: DraftState, managerPosition: number): DraftPick[] {
  return state.picks.filter(p => p.participantId === `manager-${managerPosition}`);
}

export function getTeamStackScore(state: DraftState, team: string): number {
  const yourPicks = getParticipantPicks(state, state.yourParticipantId);
  return yourPicks.filter(p => {
    const player = state.availablePlayers.find(ap => ap.name === p.playerName);
    return 0;
  }).length;
}

export function calculateDraftGrade(state: DraftState): string {
  return 'B'; // Placeholder
}

export function initializeDraft(config: DraftConfig, players: Player[]): DraftState {
  return {
    managers: config.managers,
    yourPosition: config.yourPosition,
    yourParticipantId: `manager-${config.yourPosition - 1}`,
    playersPerTeam: config.playersPerTeam,
    currentRound: 1,
    currentPick: 1,
    picks: [],
    availablePlayers: [...players],
  };
}

export function undoLastPick(state: DraftState, allPlayers: Player[]): DraftState {
  if (state.picks.length === 0) {
    return state; // Can't undo if no picks
  }

  const lastPick = state.picks[state.picks.length - 1];
  const playerName = lastPick.playerName;

  // Go back one pick
  let prevRound = state.currentRound;
  let prevPick = state.currentPick - 1;

  if (prevPick < 1) {
    prevRound -= 1;
    prevPick = state.managers;
  }

  // Remove the last pick and restore the player
  const restoredPlayer = allPlayers.find(p => p.name === playerName);

  return {
    ...state,
    currentRound: prevRound,
    currentPick: prevPick,
    picks: state.picks.slice(0, -1),
    availablePlayers: restoredPlayer
      ? [...state.availablePlayers, restoredPlayer].sort(
          (a, b) => b.displayPoints - a.displayPoints
        )
      : state.availablePlayers,
  };
}

export function removeSpecificPick(state: DraftState, pickIndex: number, allPlayers: Player[]): DraftState {
  if (pickIndex < 0 || pickIndex >= state.picks.length) {
    return state;
  }

  const pickToRemove = state.picks[pickIndex];
  const playerName = pickToRemove.playerName;

  // Remove the pick and restore the player
  const restoredPlayer = allPlayers.find(p => p.name === playerName);

  const newPicks = state.picks.filter((_, index) => index !== pickIndex);

  return {
    ...state,
    picks: newPicks,
    availablePlayers: restoredPlayer
      ? [...state.availablePlayers, restoredPlayer].sort(
          (a, b) => b.displayPoints - a.displayPoints
        )
      : state.availablePlayers,
  };
}
