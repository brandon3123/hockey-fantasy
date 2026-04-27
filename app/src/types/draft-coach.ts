import type { Player } from './player';

// Strategy presets with weighting configs
export interface DraftStrategy {
  id: 'team-stack' | 'balanced' | 'stars-depth';
  name: string;
  description: string;
  weights: {
    talent: number;
    teamStack: number;
    position: number;
    value: number;
    opponent: number;
  };
}

// Line combinations from MoneyPuck
export interface LineCombination {
  lineId: string;
  team: string;
  name: string;
  players: string[];
  position: 'line' | 'pairing';
  situation: string;
  icetime: number;
  games_played: number;
  metrics: {
    xGoalsPercentage: number;
    corsiPercentage: number;
  };
}

// Team quality from MoneyPuck rankings
export interface TeamQuality {
  team: string;
  overall: { avg: number; min: number; max: number };
  goalie: { avg: number; min: number; max: number };
  fancy: { avg: number };
  record: { avg: number };
}

// Recommendation with reasoning
export interface DraftRecommendation {
  player: Player;
  score: number;
  reasoning: {
    primary: string;
    secondary: string[];
  };
  fit: 'excellent' | 'good' | 'fair';
  stackBonus: number;
}

// Draft coach analysis output
export interface DraftCoachAnalysis {
  recommendations: DraftRecommendation[];
  yourTeam: {
    composition: Record<string, number>;
    teams: Record<string, number>;
    lines: Array<{ line: LineCombination; yourPlayerCount: number }>;
    needs: string[];
  };
  opponents: Record<string, {
    needs: string[];
    likelyTargets: string[];
    stackConcern: 'high' | 'medium' | 'low';
  }>;
  poolAnalysis: {
    position: Record<string, { remaining: number; avgQuality: number }>;
    teams: Record<string, number>;
  };
}
