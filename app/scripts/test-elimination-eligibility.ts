/**
 * Permanent test: elimination logic must be season-aware.
 *
 * Regression for: a regular-season draft completed in September showing every
 * roster player struck out in red. Both the dashboard and standings routes
 * fetched the NHL playoff bracket unconditionally; the 2026 bracket (season
 * concluded in April) marks 15 of 16 teams eliminated, so ~847/877 players
 * were rendered as eliminated. isEliminated must simply be false unless the
 * draft is actually playoffs-mode.
 *
 * Run from app/: npx tsx scripts/test-elimination-eligibility.ts
 */
import { isEliminatedFor } from '../src/lib/elimination';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// Simulates the live September state: 15 of 16 bracket teams already eliminated.
const septemberActiveTeams = new Set(['CAR']);

check('regular draft: nobody is eliminated, whatever the bracket says',
  isEliminatedFor('FLA', 'regular', septemberActiveTeams) === false
    && isEliminatedFor('TOR', 'regular', septemberActiveTeams) === false,
  true);

check('regular draft with an empty bracket: nobody eliminated',
  isEliminatedFor('EDM', 'regular', new Set()),
  false);

check('playoffs draft: a non-active team IS eliminated',
  isEliminatedFor('FLA', 'playoffs', septemberActiveTeams),
  true);

check('playoffs draft: an active team is not eliminated',
  isEliminatedFor('CAR', 'playoffs', septemberActiveTeams),
  false);

check('playoffs draft with no bracket data at all: nothing eliminated',
  isEliminatedFor('FLA', 'playoffs', new Set()),
  false);

check('unknown/blank team on a playoff draft is not struck out',
  isEliminatedFor('', 'playoffs', septemberActiveTeams),
  false);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
