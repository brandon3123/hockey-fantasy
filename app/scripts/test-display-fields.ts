/**
 * Permanent test: the one rule for what "points" means on the board.
 *
 * Regression for: every player showing a projected total of 0 before the
 * season starts. The rule used to be duplicated with different answers -
 * the rankings page and the live-draft hook both computed G+A, which is 0
 * for everyone when no games have been played, while lib/utils had the
 * projections-first rule that solves it.
 *
 * Run from app/: npx tsx scripts/test-display-fields.ts
 */
import { displayFieldsFor, enrichDisplayFields } from '../src/lib/utils';
import type { Player } from '../src/types/player';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// McDavid-shaped row as it comes back from Supabase before the season starts.
const preseason: Player = {
  name: 'Connor McDavid', team: 'EDM', position: 'C',
  regularSeasonGoals: 0, regularSeasonAssists: 0, gamesPlayed: 0,
  pointsPerGame: 1.68,
  teamAdvancementOdds: { round1: 0.48, round2: 0.23, round3: 0.11, round4: 0.06 },
  projectedPlayoffGames: 9.5, projectedPlayoffPoints: 10.4,
  gamesRemaining: 82, projectedPoints: 138, rank: 1,
  displayPoints: 0, displayGames: 0,
  injury: { status: 'healthy', expectedReturn: null, description: null },
};

// Pre-season must show the season projection, not 0 G+A.
check(
  'pre-season: projections first',
  displayFieldsFor(preseason, 'regular'),
  { displayPoints: 138, displayGames: 82 },
);

// Once games are played, actuals take over.
const inSeason: Player = { ...preseason, gamesPlayed: 10, regularSeasonGoals: 4, regularSeasonAssists: 8 };
check(
  'in-season: actual G+A and games played',
  displayFieldsFor(inSeason, 'regular'),
  { displayPoints: 12, displayGames: 10 },
);

// Playoffs mode has its own pair of fields, used regardless of gamesPlayed.
check(
  'playoffs mode: playoff projections',
  displayFieldsFor(preseason, 'playoffs'),
  { displayPoints: 10.4, displayGames: 9.5 },
);

// A player with no data anywhere must read 0, not NaN.
check(
  'missing fields fall back to 0',
  displayFieldsFor({ ...preseason, projectedPoints: undefined, projectedPlayoffPoints: undefined } as unknown as Player, 'regular'),
  { displayPoints: 0, displayGames: 82 },
);

// The raw players.json fallback path goes through the same rule.
const raw = { ...preseason } as Partial<Player>;
delete raw.displayPoints;
delete raw.displayGames;
const enriched = enrichDisplayFields(raw as Player);
check('enrichDisplayFields uses the shared rule', { displayPoints: enriched.displayPoints, displayGames: enriched.displayGames }, { displayPoints: 138, displayGames: 82 });

// Rows that already carry a playoff display value from their mapper must not
// leak into regular mode - the rebuild is authoritative.
const preset = Object.assign({ ...preseason }, { displayPoints: 3.6, displayGames: 3.6 });
check(
  'preset values are rebuilt, not trusted',
  displayFieldsFor(preset as Player, 'regular'),
  { displayPoints: 138, displayGames: 82 },
);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
