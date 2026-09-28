/**
 * Permanent test: team-pick entries offered when the toggle is on.
 *
 * Run from app/: npx tsx scripts/test-team-picks.ts
 */
import { teamPickEntries, TEAM_PICK_POSITION } from '../src/lib/team-picks';
import { isTeamPick } from '../src/lib/scoring';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const entries = teamPickEntries();

check('32 team entries', entries.length, 32);
check('ids unique', new Set(entries.map(e => e.playerId)).size, 32);
check('every id passes isTeamPick', entries.every(e => isTeamPick(e.playerId)), true);
check('every position is TEAM', entries.every(e => e.position === TEAM_PICK_POSITION), true);

const edm = entries.find(e => e.playerId === 'team-edm');
check('team-edm is Edmonton Oilers', edm && { name: edm.playerName, team: edm.team }, { name: 'Edmonton Oilers', team: 'EDM' });
check('entries carry Player-compatible name + id', entries.every(e => e.name === e.playerName && e.id === e.playerId), true);

check('entries are zero-safe on points', entries.every(e => e.displayPoints === 0 && e.displayGames === 0), true);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
