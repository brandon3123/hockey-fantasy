/**
 * The one scoring definition every write path shares (cron, manual entry,
 * backfill). Keeping the math in one place is the point: the three paths
 * cannot drift.
 */
import type { DraftPick } from '@/types/player';

export type ScoringFormat = '1pt_per_goal_assist' | '2pt_goals_1pt_assists';

export interface PlayerScoringOpts {
  scoringFormat: string;
  isDefenseman: boolean;
  dGoalBonus: boolean;
}

/** Player points: base format math, plus +1 per goal when the D bonus is on. */
export function computePlayerPoints(
  goals: number,
  assists: number,
  opts: PlayerScoringOpts,
): number {
  const base = opts.scoringFormat === '2pt_goals_1pt_assists'
    ? goals * 2 + assists
    : goals + assists;
  return opts.dGoalBonus && opts.isDefenseman ? base + goals : base;
}

/** Team pick points: win 1, shutout 2 total, anything else 0. */
export function computeTeamPoints(won: boolean, shutout: boolean): number {
  if (!won) return 0;
  return shutout ? 2 : 1;
}

/** Team picks use ids like 'team-edm'. */
export function isTeamPick(playerId: string): boolean {
  return playerId.startsWith('team-');
}

/** 'team-edm' -> 'EDM'; non-team ids -> ''. */
export function teamAbbrevFromPick(playerId: string): string {
  if (!isTeamPick(playerId)) return '';
  return playerId.slice('team-'.length).toUpperCase();
}
