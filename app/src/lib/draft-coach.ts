import { Player } from '@/types/player';
import { DraftState } from '@/types/player';
import { DraftStrategy, DraftRecommendation, LineCombination, TeamQuality } from '@/types/draft-coach';
import { getParticipantPicks, getCurrentPickNumber } from './draft-logic';
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
  lines: Array<{ line: LineCombination; yourPlayerCount: number }>;
  needs: string[];
}

interface OpponentState {
  participantId: string;
  teamName: string;
  needs: string[];
  positionNeeds: string[];
  likelyTargets: string[];
  stackConcern: 'high' | 'medium' | 'low';
}

export function analyzeYourTeam(draftState: DraftState, lines: LineCombination[], availablePlayers: Player[] = [], allPlayers: Player[] = []): YourTeamState {
  const yourPicks = getParticipantPicks(draftState, draftState.yourParticipantId);

  // Count positions and teams from actual picks
  const composition: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0 };
  const teams: Record<string, number> = {};
  const yourLines: Array<{ line: LineCombination; yourPlayerCount: number }> = [];

  // Use allPlayers to find drafted player data (not availablePlayers)
  const playerPool = allPlayers.length > 0 ? allPlayers : availablePlayers;

  yourPicks.forEach(pick => {
    // Find the player data to get position/team
    const player = playerPool.find(p => p.name === pick.playerName);
    if (player) {
      composition[player.position] = (composition[player.position] || 0) + 1;
      teams[player.team] = (teams[player.team] || 0) + 1;
    }
  });

  // Find partial lines - lines where you have 1-2 players
  lines.forEach(line => {
    const yourPlayersInLine = line.players.filter(playerName =>
      yourPicks.some(pick => pick.playerName === playerName)
    );
    if (yourPlayersInLine.length > 0) {
      yourLines.push({ line, yourPlayerCount: yourPlayersInLine.length });
    }
  });

  // Calculate needs based on target roster composition
  const targetCounts = { C: 4, LW: 4, RW: 4, D: 6 };
  const needs: string[] = [];
  Object.entries(targetCounts).forEach(([pos, target]) => {
    const current = composition[pos] || 0;
    if (current < target) {
      needs.push(`Need ${target - current} ${pos}`);
    }
  });

  return { composition, teams, lines: yourLines, needs };
}

export function analyzeOpponents(draftState: DraftState, lines: LineCombination[], availablePlayers: Player[] = [], allPlayers: Player[] = [], participantNames: Record<string, string> = {}): OpponentState[] {
  const opponents: OpponentState[] = [];
  const targetCounts = { C: 4, LW: 4, RW: 4, D: 6 };

  const playerPool = allPlayers.length > 0 ? allPlayers : availablePlayers;

  const participantIds = [...new Set(draftState.picks.map(p => p.participantId))]
    .filter(id => id !== draftState.yourParticipantId);

  for (const participantId of participantIds) {
    const picks = getParticipantPicks(draftState, participantId);

    const composition: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0 };
    const teams: Record<string, number> = {};
    const partialLines: LineCombination[] = [];

    picks.forEach(pick => {
      const player = playerPool.find(p => p.name === pick.playerName);
      if (player) {
        composition[player.position] = (composition[player.position] || 0) + 1;
        teams[player.team] = (teams[player.team] || 0) + 1;

        const playerLine = getPlayerLine(player.name, lines);
        if (playerLine) {
          const existingLine = partialLines.find(l => l.lineId === playerLine.lineId);
          if (!existingLine) {
            partialLines.push(playerLine);
          }
        }
      }
    });

    const needs: string[] = [];
    const positionNeeds: string[] = [];
    Object.entries(targetCounts).forEach(([pos, target]) => {
      const current = composition[pos] || 0;
      if (current < target) {
        needs.push(pos);
        positionNeeds.push(pos);
      }
    });

    const likelyTargets: string[] = [];
    partialLines.forEach(line => {
      const playersOnLine = picks.filter(pick =>
        line.players.includes(pick.playerName)
      ).length;

      if (playersOnLine >= 2) {
        line.players.forEach(playerName => {
          if (!picks.some(pick => pick.playerName === playerName)) {
            const player = playerPool.find(p => p.name === playerName);
            if (player) {
              likelyTargets.push(playerName);
            }
          }
        });
      }
    });

    const maxTeamCount = Math.max(...Object.values(teams), 0);
    let stackConcern: 'high' | 'medium' | 'low' = 'low';
    if (maxTeamCount >= 3) stackConcern = 'high';
    else if (maxTeamCount >= 2) stackConcern = 'medium';

    opponents.push({
      participantId,
      teamName: participantNames[participantId] || participantId,
      needs,
      positionNeeds,
      likelyTargets,
      stackConcern
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

  const normalizedTalent = player.displayPoints / 10;

  score += normalizedTalent * strategy.weights.talent;

  const stackBonus = calculateStackBonus(player, context.yourTeam, lineCache);
  score += stackBonus * strategy.weights.teamStack;

  const positionBonus = calculatePositionBonus(player, context.yourTeam);
  score += positionBonus * strategy.weights.position;

  const valueScore = calculateValueScore(player, context.currentPick);
  score += valueScore * strategy.weights.value;

  const blockScore = calculateBlockScore(player, context.opponents);
  score += blockScore * strategy.weights.opponent;

  return score;
}

function calculateStackBonus(player: Player, yourTeam: YourTeamState, lineCache: LineCombination[]): number {
  const playerLine = getPlayerLine(player.name, lineCache);
  if (playerLine) {
    const lineWithCount = yourTeam.lines.find(l => l.line.lineId === playerLine.lineId);
  if (lineWithCount && lineWithCount.yourPlayerCount >= 2) {
    return 1.0 + lineWithCount.yourPlayerCount * 0.5;
  }
  if (lineWithCount && lineWithCount.yourPlayerCount >= 1) {
    return 0.4;
  }
  }

  const teamCount = yourTeam.teams[player.team] || 0;
  if (teamCount >= 3) {
    return 1.5 + teamCount * 0.5;
  }
  if (teamCount >= 2) {
    return 0.6;
  }
  if (teamCount >= 1) {
    return 0.15;
  }

  return 0;
}

function calculatePositionBonus(player: Player, yourTeam: YourTeamState): number {
  const positionCount = yourTeam.composition[player.position] || 0;
  const targetCounts = { C: 4, LW: 4, RW: 4, D: 6 };

  if (positionCount < targetCounts[player.position]) {
    return 0.3 + (targetCounts[player.position] - positionCount) * 0.15;
  }
  return 0;
}

function calculateValueScore(player: Player, currentPick: number): number {
  let score = 0;

  // ADP value (smaller multiplier, capped to avoid overweighting)
  if (player.adp) {
    const adpDiff = currentPick - player.adp;
    if (adpDiff > 0) {
      score += Math.min(adpDiff * 0.5, 5);  // Max +5 from ADP value
    }
  }

  // Rank bonus (prefer better-ranked players - lower rank number = better)
  // This rewards players who are actually ranked higher regardless of ADP
  if (player.rank) {
    score += Math.max(0, (50 - player.rank) * 0.1);  // +5 for rank 1, +4 for rank 10, etc.
  }

  return score;
}

function calculateBlockScore(player: Player, opponents: OpponentState[]): number {
  let score = 0;
  opponents.forEach(opp => {
    if (opp.likelyTargets.includes(player.name)) {
      score += 15;
    }
    if (opp.positionNeeds.includes(player.position)) {
      score += 5;
    }
  });
  return score;
}

export function generateRecommendations(
  availablePlayers: Player[],
  draftState: DraftState,
  strategy: DraftStrategy,
  lineCache: LineCombination[],
  allPlayers: Player[] = [],
  participantNames: Record<string, string> = {}
): DraftRecommendation[] {
  const yourTeam = analyzeYourTeam(draftState, lineCache, availablePlayers, allPlayers);
  const opponents = analyzeOpponents(draftState, lineCache, availablePlayers, allPlayers, participantNames);
  const currentPick = getCurrentPickNumber(draftState);

  // Score all players
  const scoredPlayers = availablePlayers.map(player => ({
    player,
    score: scorePlayer(player, strategy, { yourTeam, opponents, poolAnalysis: {}, currentPick }, lineCache)
  }));

  // Get top 3
  return scoredPlayers
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ player, score }) => ({
      player,
      score,
      reasoning: generateReasoning(player, yourTeam, opponents, lineCache, currentPick),
      fit: calculateFit(player, yourTeam, lineCache),
      stackBonus: scorePlayer(player, { ...STRATEGIES['team-stack'] }, { yourTeam, opponents, poolAnalysis: {}, currentPick }, lineCache)
    }));
}

function generateReasoning(
  player: Player,
  yourTeam: YourTeamState,
  opponents: OpponentState[],
  lineCache: LineCombination[],
  currentPick: number
): { primary: string; secondary: string[] } {
  const reasons: string[] = [];

  // Line stacking
  const playerLine = getPlayerLine(player.name, lineCache);
  if (playerLine) {
    const lineWithCount = yourTeam.lines.find(l => l.line.lineId === playerLine.lineId);
    if (lineWithCount) {
      const yourPlayersOnLine = lineWithCount.yourPlayerCount;
      if (yourPlayersOnLine >= 2) {
        const stackBonus = Math.pow(10, yourPlayersOnLine + 1) - 10;
        reasons.push(`Completes your ${player.team} line (+${stackBonus} stack bonus)`);
      } else if (yourPlayersOnLine >= 1) {
        reasons.push(`Adds to your ${player.team} line stack`);
      }
    }
  }

  // Team stacking (if not already mentioned via line stacking)
  const teamCount = yourTeam.teams[player.team] || 0;
  if (teamCount >= 1 && !playerLine) {
    reasons.push(`Adds to ${player.team} stack (${teamCount} already)`);
  } else if (teamCount >= 2) {
    const stackBonus = Math.pow(3, teamCount + 1) - 3;
    reasons.push(`Strengthens ${player.team} stack (+${stackBonus})`);
  }

  // Positional need
  const posCount = yourTeam.composition[player.position] || 0;
  const targetCounts = { C: 4, LW: 4, RW: 4, D: 6 };
  if (posCount < targetCounts[player.position]) {
    const need = targetCounts[player.position] - posCount;
    reasons.push(`Fills ${player.position} need (${need} more required)`);
  }

  // Value calculation
  if (player.adp) {
    const adpDiff = currentPick - player.adp;
    if (adpDiff > 10) {
      reasons.push(`Value pick +${adpDiff.toFixed(0)} ADP (ranked #${player.adp.toFixed(0)}, picking #${currentPick})`);
    } else if (adpDiff > 0) {
      reasons.push(`Value +${adpDiff.toFixed(0)} ADP`);
    }
  }

  // Opponent blocking
  const blockingReasons: string[] = [];
  opponents.forEach(opp => {
    if (opp.likelyTargets.includes(player.name)) {
      blockingReasons.push(`Blocks ${opp.teamName} from targeting ${player.name}`);
    } else if (opp.positionNeeds.includes(player.position)) {
      blockingReasons.push(`Blocks ${opp.teamName} from getting ${player.position}`);
    }
  });
  // Add at most 2 blocking reasons to avoid clutter
  reasons.push(...blockingReasons.slice(0, 2));

  // Talent indicator
  const reasonsTalent: string[] = [];
  if (player.displayPoints > 25) {
    reasonsTalent.push(`Elite talent (${player.displayPoints.toFixed(1)} pts)`);
  } else if (player.displayPoints > 20) {
    reasonsTalent.push(`Strong producer (${player.displayPoints.toFixed(1)} pts)`);
  }

  return {
    primary: reasons[0] || reasonsTalent[0] || 'Best available talent',
    secondary: [...reasons.slice(1), ...reasonsTalent.slice(1)]
  };
}

function calculateFit(player: Player, yourTeam: YourTeamState, lineCache: LineCombination[]): 'excellent' | 'good' | 'fair' {
  const playerLine = getPlayerLine(player.name, lineCache);
  if (playerLine) {
    const lineWithCount = yourTeam.lines.find(l => l.line.lineId === playerLine.lineId);
    if (lineWithCount) {
      const yourPlayersOnLine = lineWithCount.yourPlayerCount;
      if (yourPlayersOnLine >= 2) return 'excellent';
      if (yourPlayersOnLine >= 1) return 'good';
    }
  }

  // Also check team stacking (any players from same team)
  const teamCount = yourTeam.teams[player.team] || 0;
  if (teamCount >= 2) return 'good';
  if (teamCount >= 1) return 'fair'; // At least 1 teammate

  return 'fair';
}
