import { Player } from '@/types/player';
import { DraftState } from '@/types/player';
import { DraftStrategy, DraftRecommendation, LineCombination, TeamQuality } from '@/types/draft-coach';
import { getManagerPicks, getCurrentPickNumber } from './draft-logic';
import { getPlayerLine, getTeammates, getLinesByTeam } from './moneypuck-parser';

// Strategy definitions
export const STRATEGIES: Record<string, DraftStrategy> = {
  'team-stack': {
    id: 'team-stack',
    name: 'Team Stack',
    description: 'Prioritize stacking multiple players from same team/line',
    weights: { talent: 0.4, teamStack: 0.4, position: 0.1, value: 0.05, opponent: 0.05 }
  },
  'balanced': {
    id: 'balanced',
    name: 'Balanced',
    description: 'Mix of talent, team stacking, and positional balance',
    weights: { talent: 0.5, teamStack: 0.2, position: 0.2, value: 0.05, opponent: 0.05 }
  },
  'stars-depth': {
    id: 'stars-depth',
    name: 'Stars + Depth',
    description: 'Elite talent early, value picks late',
    weights: { talent: 0.7, teamStack: 0.1, position: 0.1, value: 0.1, opponent: 0.0 }
  }
};

interface DraftContext {
  yourTeam: YourTeamState;
  opponents: OpponentState[];
  poolAnalysis: any;
  currentPick: number;
}

interface YourTeamState {
  composition: Record<string, number>;
  teams: Record<string, number>;
  lines: LineCombination[];
  needs: string[];
}

interface OpponentState {
  managerIndex: number;
  needs: string[];
  likelyTargets: string[];
  stackConcern: 'high' | 'medium' | 'low';
}

export function analyzeYourTeam(draftState: DraftState, lines: LineCombination[]): YourTeamState {
  const yourPicks = getManagerPicks(draftState, draftState.yourPosition - 1);

  // Count positions
  const composition: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0 };
  const teams: Record<string, number> = {};

  yourPicks.forEach(pick => {
    // Find player data - this is simplified, will need full integration
    composition['C'] += 1; // Placeholder
  });

  // Get partial lines
  const yourLines: LineCombination[] = [];
  // Find lines where you have 1-2 players

  // Calculate needs
  const targetCounts = { C: 4, LW: 4, RW: 4, D: 6 };
  const needs: string[] = [];
  Object.entries(targetCounts).forEach(([pos, target]) => {
    if ((composition[pos] || 0) < target) {
      needs.push(`Need ${target - (composition[pos] || 0)} ${pos}`);
    }
  });

  return { composition, teams, lines: yourLines, needs };
}

export function analyzeOpponents(draftState: DraftState, lines: LineCombination[]): OpponentState[] {
  const opponents: OpponentState[] = [];

  for (let i = 0; i < draftState.managers; i++) {
    if (i === draftState.yourPosition - 1) continue;

    const picks = getManagerPicks(draftState, i);
    opponents.push({
      managerIndex: i,
      needs: ['C', 'D'], // Placeholder
      likelyTargets: [],
      stackConcern: 'low'
    });
  }

  return opponents;
}

export function scorePlayer(
  player: Player,
  strategy: DraftStrategy,
  context: DraftContext,
  lineCache: LineCombination[]
): number {
  let score = 0;

  // Base talent
  score += player.projectedPlayoffPoints * strategy.weights.talent;

  // Team stacking
  const stackBonus = calculateStackBonus(player, context.yourTeam, lineCache);
  score += stackBonus * strategy.weights.teamStack;

  // Positional need
  const positionBonus = calculatePositionBonus(player, context.yourTeam);
  score += positionBonus * strategy.weights.position;

  // Value
  const valueScore = calculateValueScore(player, context.currentPick);
  score += valueScore * strategy.weights.value;

  // Opponent blocking
  const blockScore = calculateBlockScore(player, context.opponents);
  score += blockScore * strategy.weights.opponent;

  return score;
}

function calculateStackBonus(player: Player, yourTeam: YourTeamState, lineCache: LineCombination[]): number {
  const playerLine = getPlayerLine(player.name, lineCache);
  if (!playerLine) return 0;

  const yourPlayersOnLine = yourTeam.lines.filter(l => l.lineId === playerLine.lineId).length;

  // Exponential bonus for completing lines
  return Math.pow(10, yourPlayersOnLine + 1) - 10;
}

function calculatePositionBonus(player: Player, yourTeam: YourTeamState): number {
  const positionCount = yourTeam.composition[player.position] || 0;
  const targetCounts = { C: 4, LW: 4, RW: 4, D: 6 };

  if (positionCount < targetCounts[player.position]) {
    return (targetCounts[player.position] - positionCount) * 5;
  }
  return 0;
}

function calculateValueScore(player: Player, currentPick: number): number {
  if (!player.adp) return 0;
  const adpDiff = currentPick - player.adp;
  return adpDiff > 0 ? adpDiff * 2 : 0;
}

function calculateBlockScore(player: Player, opponents: OpponentState[]): number {
  let score = 0;
  opponents.forEach(opp => {
    if (opp.likelyTargets.includes(player.name)) {
      score += 20;
    }
    if (opp.needs.includes(player.position)) {
      score += 5;
    }
  });
  return score;
}

export function generateRecommendations(
  availablePlayers: Player[],
  draftState: DraftState,
  strategy: DraftStrategy,
  lineCache: LineCombination[]
): DraftRecommendation[] {
  const yourTeam = analyzeYourTeam(draftState, lineCache);
  const opponents = analyzeOpponents(draftState, lineCache);
  const currentPick = getCurrentPickNumber(draftState);

  // Score all players
  const scoredPlayers = availablePlayers.map(player => ({
    player,
    score: scorePlayer(player, strategy, { yourTeam, opponents, poolAnalysis: {}, currentPick }, lineCache)
  }));

  // Get top 3
  return scoredPlayers
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ player, score }) => ({
      player,
      score,
      reasoning: generateReasoning(player, yourTeam, opponents, lineCache),
      fit: calculateFit(player, yourTeam, lineCache),
      stackBonus: scorePlayer(player, { ...STRATEGIES['team-stack'] }, { yourTeam, opponents, poolAnalysis: {}, currentPick }, lineCache)
    }));
}

function generateReasoning(
  player: Player,
  yourTeam: YourTeamState,
  opponents: OpponentState[],
  lineCache: LineCombination[]
): { primary: string; secondary: string[] } {
  const reasons: string[] = [];

  // Line stacking
  const playerLine = getPlayerLine(player.name, lineCache);
  if (playerLine) {
    const yourPlayersOnLine = yourTeam.lines.filter(l => l.lineId === playerLine.lineId).length;
    if (yourPlayersOnLine >= 2) {
      reasons.push(`Completes your ${player.team} line`);
    } else if (yourPlayersOnLine >= 1) {
      reasons.push(`Adds to your ${player.team} line stack`);
    }
  }

  // Positional need
  const posCount = yourTeam.composition[player.position] || 0;
  if (posCount < 2) {
    reasons.push(`Fills ${player.position} need`);
  }

  // Value
  if (player.adp) {
    const currentPick = getCurrentPickNumber({ currentRound: 1, currentPick: 1, managers: 7, yourPosition: 1, playersPerTeam: 10, picks: [], availablePlayers: [] });
    if (currentPick > player.adp + 10) {
      reasons.push(`Value pick +${Math.round(currentPick - player.adp)} ADP`);
    }
  }

  return {
    primary: reasons[0] || 'Best available talent',
    secondary: reasons.slice(1)
  };
}

function calculateFit(player: Player, yourTeam: YourTeamState, lineCache: LineCombination[]): 'excellent' | 'good' | 'fair' {
  const playerLine = getPlayerLine(player.name, lineCache);
  if (playerLine) {
    const yourPlayersOnLine = yourTeam.lines.filter(l => l.lineId === playerLine.lineId).length;
    if (yourPlayersOnLine >= 2) return 'excellent';
    if (yourPlayersOnLine >= 1) return 'good';
  }
  return 'fair';
}
