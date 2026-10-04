/**
 * The one scoring definition every write path shares (cron, manual entry,
 * backfill). Keeping the math in one place is the point: the three paths
 * cannot drift.
 */

/**
 * Credit the game-winning goal: the winning team's (loser goals + 1)th goal,
 * walked chronologically through the landing endpoint's periods.
 * Equal goal totals (shootout-decided) credit nobody.
 */
export function deriveGameWinningGoal(
  scoringPeriods: Array<{
    goals?: Array<{
      teamAbbrev?: { default?: string };
      playerId?: number;
    }>;
  }>,
  awayAbbrev: string,
  homeAbbrev: string,
): number | null {
  const goals: Array<{ team: string; playerId: number }> = [];
  for (const period of scoringPeriods ?? []) {
    for (const g of period.goals ?? []) {
      const team = g.teamAbbrev?.default ?? '';
      if (!team || !g.playerId) continue;
      goals.push({ team, playerId: g.playerId });
    }
  }

  const count = (team: string) => goals.filter(g => g.team === team).length;
  const awayCount = count(awayAbbrev);
  const homeCount = count(homeAbbrev);
  if (awayCount === homeCount) return null;
  const winner = awayCount > homeCount ? awayAbbrev : homeAbbrev;
  const loserGoals = awayCount > homeCount ? homeCount : awayCount;

  let winnerGoals = 0;
  for (const g of goals) {
    if (g.team !== winner) continue;
    winnerGoals += 1;
    if (winnerGoals === loserGoals + 1) return g.playerId;
  }
  return null;
}

export type ScoringFormat = '1pt_per_goal_assist' | '2pt_goals_1pt_assists';

export interface PlayerScoringOpts {
  scoringFormat: string;
  isDefenseman: boolean;
  dGoalBonus: boolean;
  /** How of the player's goals were game-winners (0 or 1 per game). */
  gameWinningGoals: number;
  gwgBonus: boolean;
}

/** Player points: base format math, plus +1 per goal when the D bonus is on, plus +1 per game-winning goal when the GWG bonus is on. */
export function computePlayerPoints(
  goals: number,
  assists: number,
  opts: PlayerScoringOpts,
): number {
  const base = opts.scoringFormat === '2pt_goals_1pt_assists'
    ? goals * 2 + assists
    : goals + assists;
  let points = base;
  if (opts.dGoalBonus && opts.isDefenseman) points += goals;
  if (opts.gwgBonus) points += opts.gameWinningGoals;
  return points;
}

/** Team pick points: win 1, shutout 2 total, anything else 0. */
export function computeTeamPoints(won: boolean, shutout: boolean): number {
  if (!won) return 0;
  return shutout ? 2 : 1;
}

export interface ScoreRow {
  player_id: string;
  draft_id: string;
  season_type: string;
  score_date: string;
  goals: number;
  assists: number;
  points: number;
  gwg: number;
}

/**
 * Merge score rows that share a conflict key (player_id + draft_id +
 * score_date). A player can appear in TWO games on one date (preseason
 * split-squad doubleheaders), and duplicate keys in a single upsert fail the
 * whole batch — so same-day lines are summed into one row, including gwg
 * counts.
 */
export function aggregatePlayerRows(rows: ScoreRow[]): ScoreRow[] {
  const merged = new Map<string, ScoreRow>();
  for (const row of rows) {
    const existing = merged.get(row.player_id);
    if (!existing) {
      merged.set(row.player_id, { ...row });
      continue;
    }
    existing.goals += row.goals;
    existing.assists += row.assists;
    existing.points += row.points;
    existing.gwg += row.gwg;
  }
  return [...merged.values()];
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
