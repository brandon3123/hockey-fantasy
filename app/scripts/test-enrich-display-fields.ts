/**
 * Permanent test: enrichDisplayFields display-field precedence.
 * In-season (gamesPlayed > 0): actual G+A / games played.
 * Pre-season (gamesPlayed === 0): projections first — projectedPoints / gamesRemaining.
 * Already-enriched entries pass through untouched.
 *
 * Run from app/: npx tsx scripts/test-enrich-display-fields.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { enrichDisplayFields } from '../src/lib/utils';
import type { Player } from '../src/types/player';

type RawPlayer = Omit<Player, 'displayPoints' | 'displayGames'> &
  Partial<Pick<Player, 'displayPoints' | 'displayGames'>>;

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = Object.is(actual, expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${actual}, expected ${expected}`);
}

function basePlayer(overrides: Partial<RawPlayer> = {}): RawPlayer {
  return {
    name: 'Test Player',
    team: 'TBL',
    position: 'C',
    regularSeasonGoals: 0,
    regularSeasonAssists: 0,
    gamesPlayed: 0,
    pointsPerGame: 0,
    teamAdvancementOdds: { round1: 0.8, round2: 0.4, round3: 0.2, round4: 0.1 },
    projectedPlayoffGames: 10,
    projectedPlayoffPoints: 12,
    gamesRemaining: 82,
    projectedPoints: 0,
    rank: 1,
    injury: { status: 'healthy', expectedReturn: null, description: null },
    ...overrides,
  };
}

// 1. In-season: actuals win over projections.
const inSeason = enrichDisplayFields(
  basePlayer({ gamesPlayed: 82, regularSeasonGoals: 44, regularSeasonAssists: 86, projectedPoints: 90 })
);
check('in-season displayPoints (G+A beats projection)', inSeason.displayPoints, 130);
check('in-season displayGames', inSeason.displayGames, 82);

// 2. Pre-season with projection: projections first.
const preseason = enrichDisplayFields(
  basePlayer({ projectedPoints: 87.5, gamesRemaining: 82 })
);
check('pre-season displayPoints (projection)', preseason.displayPoints, 87.5);
check('pre-season displayGames (gamesRemaining)', preseason.displayGames, 82);

// 3. Pre-season without projection: zero-safe.
const noProj = enrichDisplayFields(basePlayer({ projectedPoints: 0 }));
check('pre-season no-projection displayPoints', noProj.displayPoints, 0);
check('pre-season no-projection displayGames', noProj.displayGames, 82);

// 4. Already enriched: REBUILT, not trusted. The passthrough contract was
// superseded when displayFieldsFor became the one rule — passthrough is what
// let mapper-preset playoff values leak into regular-mode boards (the
// "all players read 0" bug family). See scripts/test-display-fields.ts.
const passthrough = enrichDisplayFields(
  basePlayer({ gamesPlayed: 82, regularSeasonGoals: 20, regularSeasonAssists: 30, displayPoints: 55.5, displayGames: 12 })
);
check('preset displayPoints rebuilt by the rule (G+A wins in-season)', passthrough.displayPoints, 50);
check('preset displayGames rebuilt by the rule (games played)', passthrough.displayGames, 82);

// 5. Regression: every real players.json entry enriches per the precedence rule.
// Robust to both in-season data (stale file) and pre-season data (after Task 8's run).
const raw = JSON.parse(
  readFileSync(join(__dirname, '..', 'public', 'players.json'), 'utf8')
) as RawPlayer[];
check('players.json has entries', raw.length > 300, true);
for (const p of raw) {
  const e = enrichDisplayFields(p);
  const gp = p.gamesPlayed ?? 0;
  if (gp > 0) {
    if (e.displayPoints !== (p.regularSeasonGoals ?? 0) + (p.regularSeasonAssists ?? 0) || e.displayGames !== gp) {
      failures += 1;
      console.log(`FAIL in-season precedence for ${p.name}: ${e.displayPoints}/${e.displayGames}`);
    }
  } else if (e.displayPoints !== (p.projectedPoints ?? 0) || e.displayGames !== (p.gamesRemaining ?? 0)) {
    failures += 1;
    console.log(`FAIL pre-season precedence for ${p.name}: ${e.displayPoints}/${e.displayGames}`);
  }
}
console.log(`Regression: enriched ${raw.length} real players.json entries`);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
