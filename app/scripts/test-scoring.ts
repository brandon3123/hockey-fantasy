/**
 * Permanent test: the one scoring lib every write path shares.
 *
 * Run from app/: npx tsx scripts/test-scoring.ts
 */
import { aggregatePlayerRows, computePlayerPoints, computeTeamPoints, isTeamPick, teamAbbrevFromPick } from '../src/lib/scoring';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const onePt = '1pt_per_goal_assist';
const twoPt = '2pt_goals_1pt_assists';

// Base formats unchanged.
check('1pt format: G+A', computePlayerPoints(2, 1, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: false, gameWinningGoals: 0, gwgBonus: false }), 3);
check('2G/1A format', computePlayerPoints(2, 1, { scoringFormat: twoPt, isDefenseman: false, dGoalBonus: false, gameWinningGoals: 0, gwgBonus: false }), 5);

// D bonus: +1 per D goal, assists never affected.
check('D goal with bonus in 1pt format = 2', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: true, dGoalBonus: true, gameWinningGoals: 0, gwgBonus: false }), 2);
check('D goal without bonus = 1', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: true, dGoalBonus: false, gameWinningGoals: 0, gwgBonus: false }), 1);
check('skater goal unaffected by the toggle', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: true, gameWinningGoals: 0, gwgBonus: false }), 1);
check('D goal with bonus in 2G/1A = 3', computePlayerPoints(1, 0, { scoringFormat: twoPt, isDefenseman: true, dGoalBonus: true, gameWinningGoals: 0, gwgBonus: false }), 3);
check('D assists never bonus', computePlayerPoints(0, 2, { scoringFormat: twoPt, isDefenseman: true, dGoalBonus: true, gameWinningGoals: 0, gwgBonus: false }), 2);
check('two D goals + assist = 5', computePlayerPoints(2, 1, { scoringFormat: onePt, isDefenseman: true, dGoalBonus: true, gameWinningGoals: 0, gwgBonus: false }), 5);

// Team points: win 1, shutout 2 total, loss 0.
check('shutout win = 2 total', computeTeamPoints(true, true), 2);
check('plain win = 1', computeTeamPoints(true, false), 1);
check('loss = 0', computeTeamPoints(false, false), 0);
check('shutout loss = 0', computeTeamPoints(false, true), 0);

// Team-pick id helpers.
check('team id detected', isTeamPick('team-edm'), true);
check('player id not a team', isTeamPick('connor-mcdavid-edm-c'), false);
check('abbrev extracted', teamAbbrevFromPick('team-edm'), 'EDM');
check('non-team abbrev is empty', teamAbbrevFromPick('connor-mcdavid-edm-c'), '');

// GWG bonus: a game-winning goal is +1 on top of base; stacks with the D
// bonus; the toggle gates it.
check('GWG with bonus in 1pt format = 2', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: false, gameWinningGoals: 1, gwgBonus: true }), 2);
check('GWG without bonus = 1', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: false, gameWinningGoals: 1, gwgBonus: false }), 1);
check('GWG stacks with D bonus (D scores GWG) = 3', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: true, dGoalBonus: true, gameWinningGoals: 1, gwgBonus: true }), 3);
check('zero GWG = base only', computePlayerPoints(1, 1, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: false, gameWinningGoals: 0, gwgBonus: true }), 2);
check('GWG goal also counted in base', computePlayerPoints(2, 0, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: false, gameWinningGoals: 1, gwgBonus: true }), 3);

// Same-day doubleheaders: a player's two games must MERGE into one row —
// duplicate conflict keys in one upsert fail the whole batch ("ON CONFLICT
// DO UPDATE command cannot affect row a second time").
check('merge sums two rows for the same player', (() => {
  const merged = aggregatePlayerRows([
    { player_id: 'p1', draft_id: 'd', season_type: 'regular_season', score_date: '2026-10-03', goals: 2, assists: 0, points: 2 },
    { player_id: 'p1', draft_id: 'd', season_type: 'regular_season', score_date: '2026-10-03', goals: 1, assists: 1, points: 2 },
  ]);
  return merged.length === 1 && merged[0].goals === 3 && merged[0].assists === 1 && merged[0].points === 4;
})(), true);
check('different players stay separate rows', (() => {
  const merged = aggregatePlayerRows([
    { player_id: 'p1', draft_id: 'd', season_type: 'regular_season', score_date: '2026-10-03', goals: 1, assists: 0, points: 1 },
    { player_id: 'p2', draft_id: 'd', season_type: 'regular_season', score_date: '2026-10-03', goals: 1, assists: 0, points: 1 },
  ]);
  return merged.length === 2;
})(), true);
check('merge handles an empty batch', aggregatePlayerRows([]).length, 0);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
