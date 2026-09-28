/**
 * Permanent test: the one scoring lib every write path shares.
 *
 * Run from app/: npx tsx scripts/test-scoring.ts
 */
import { computePlayerPoints, computeTeamPoints, isTeamPick, teamAbbrevFromPick } from '../src/lib/scoring';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const onePt = '1pt_per_goal_assist';
const twoPt = '2pt_goals_1pt_assists';

// Base formats unchanged.
check('1pt format: G+A', computePlayerPoints(2, 1, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: false }), 3);
check('2G/1A format', computePlayerPoints(2, 1, { scoringFormat: twoPt, isDefenseman: false, dGoalBonus: false }), 5);

// D bonus: +1 per D goal, assists never affected.
check('D goal with bonus in 1pt format = 2', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: true, dGoalBonus: true }), 2);
check('D goal without bonus = 1', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: true, dGoalBonus: false }), 1);
check('skater goal unaffected by the toggle', computePlayerPoints(1, 0, { scoringFormat: onePt, isDefenseman: false, dGoalBonus: true }), 1);
check('D goal with bonus in 2G/1A = 3', computePlayerPoints(1, 0, { scoringFormat: twoPt, isDefenseman: true, dGoalBonus: true }), 3);
check('D assists never bonus', computePlayerPoints(0, 2, { scoringFormat: twoPt, isDefenseman: true, dGoalBonus: true }), 2);
check('two D goals + assist = 5', computePlayerPoints(2, 1, { scoringFormat: onePt, isDefenseman: true, dGoalBonus: true }), 5);

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

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
