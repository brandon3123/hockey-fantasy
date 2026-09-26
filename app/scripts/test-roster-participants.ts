/**
 * Permanent test: roster-participant name validation and seat building.
 *
 * Run from app/: npx tsx scripts/test-roster-participants.ts
 */
import { buildParticipantRows, findDuplicateName, normalizeRosterNames } from '../src/lib/roster-participants';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

check('trims and drops empty names', normalizeRosterNames(['  B  ', '', '   ', 'Kevin']), { ok: true, names: ['B', 'Kevin'] });
check('duplicate names rejected case-insensitively', normalizeRosterNames(['Brandon', 'BRANDON']), { ok: false, error: 'Duplicate team name: BRANDON' });
check('one name is too few', normalizeRosterNames(['Solo']), { ok: false, error: 'At least 2 team names required' });
check('zero names after trim is too few', normalizeRosterNames(['', '  ']), { ok: false, error: 'At least 2 team names required' });
check('21 names is too many', normalizeRosterNames(Array.from({ length: 21 }, (_, i) => `T${i}`)), { ok: false, error: 'At most 20 team names allowed' });
check('exactly 20 names is fine', normalizeRosterNames(Array.from({ length: 20 }, (_, i) => `T${i}`)).ok, true);

const rows = buildParticipantRows(['B', 'Kevin'], { draftId: 'd1', adminUserId: 'u1', seatMe: true, myName: '  Commish  ' });
check('admin seat is last with position n+1', rows.map(r => ({ team: r.team_name, pos: r.draft_position, user: r.user_id })), [
  { team: 'B', pos: 1, user: null },
  { team: 'Kevin', pos: 2, user: null },
  { team: 'Commish', pos: 3, user: 'u1' },
]);
check('rows carry the draft id', rows.every(r => r.draft_id === 'd1'), true);
check('admin seat defaults to Commissioner', buildParticipantRows(['B', 'Kevin'], { draftId: 'd1', adminUserId: 'u1', seatMe: true })[2].team_name, 'Commissioner');
check('seatMe off yields only typed rows', buildParticipantRows(['B', 'Kevin'], { draftId: 'd1', adminUserId: 'u1', seatMe: false }).length, 2);

// Uniqueness covers the FINAL seat list: typed names + the admin seat +
// start-modal renames all share one namespace (case-insensitive).
check('findDuplicateName catches case-insensitive dupes', findDuplicateName(['Brandon', 'brandon']), 'brandon');
check('findDuplicateName clean list passes', findDuplicateName(['Brandon', 'Commissioner']), null);
check('findDuplicateName ignores surrounding whitespace', findDuplicateName(['Brandon', '  Brandon  ']), 'Brandon');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
