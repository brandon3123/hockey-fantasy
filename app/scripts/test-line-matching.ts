/**
 * Permanent test: line matching and top-line ordering.
 *
 * A player must only ever match a line belonging to his own team - surnames
 * collide across teams, and a traded player can otherwise pick up a unit from
 * his old club. In pre-season every line has icetime 0 (no games played), so
 * ordering falls back to the PuckPedia lineup number.
 *
 * Run from app/: npx tsx scripts/test-line-matching.ts
 */
import { getLinesByTeam, getPlayerLine, getTeammates, getTopLine } from '../src/lib/moneypuck-parser';
import type { LineCombination } from '../src/types/draft-coach';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = Object.is(actual, expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${String(actual)}, expected ${String(expected)}`);
}

const metrics = { xGoalsPercentage: 0, corsiPercentage: 0 };

// The reported bug: an Ottawa unit from last season and Florida's current one
// both contain a "Tkachuk". The foreign line is deliberately FIRST in the
// array, and Florida's units are deliberately out of lineup order, so every
// check below can only pass on a real team filter / lineup-number sort.
const LINES: LineCombination[] = [
  {
    lineId: 'OTT-F1-1', team: 'OTT', name: 'Tkachuk-Cozens-Giroux',
    players: ['Tkachuk', 'Cozens', 'Giroux'], position: 'line', situation: '5on5',
    icetime: 4200, games_played: 60, metrics, line_number: 1,
  },
  {
    lineId: 'FLA-F2-2', team: 'FLA', name: 'Verhaeghe-Reinhart',
    players: ['Verhaeghe', 'Reinhart'], position: 'line', situation: '5on5',
    icetime: 0, games_played: 0, metrics, line_number: 2,
  },
  {
    lineId: 'FLA-D1-1', team: 'FLA', name: 'Schmidt-Ekblad',
    players: ['Schmidt', 'Ekblad'], position: 'pairing', situation: '5on5',
    icetime: 0, games_played: 0, metrics, line_number: 1,
  },
  {
    lineId: 'FLA-F1-1', team: 'FLA', name: 'Barkov-Tkachuk-Reinhart',
    players: ['Barkov', 'Tkachuk', 'Reinhart'], position: 'line', situation: '5on5',
    icetime: 0, games_played: 0, metrics, line_number: 1,
  },
];

// 1. A Florida player never picks up the Ottawa line.
check(
  'Brady Tkachuk matches the Florida line',
  getPlayerLine('Brady Tkachuk', LINES, 'FLA')?.name,
  'Barkov-Tkachuk-Reinhart',
);

// 2. Omitting the team still finds a line (older callers).
check('line lookup without a team still resolves', getPlayerLine('Brady Tkachuk', LINES) !== null, true);

// 3. Teammates come only from his own team's line (no Cozens, no Giroux).
check(
  'teammates exclude the other team',
  getTeammates('Brady Tkachuk', LINES, 'FLA').join(','),
  'Barkov,Tkachuk,Reinhart',
);

// 4. Pre-season: all icetime 0, so the 1st line must sort first.
check('top line is the first forward line', getTopLine('FLA', LINES)?.name, 'Barkov-Tkachuk-Reinhart');

// 5. Pre-season ordering: 1st forward line, then the 1st pairing, then the 2nd.
check(
  'team lines sort by lineup number, forwards first',
  getLinesByTeam('FLA', LINES).map(l => l.name).join(','),
  'Barkov-Tkachuk-Reinhart,Schmidt-Ekblad,Verhaeghe-Reinhart',
);

// 6. In-season data (real icetime) still outranks lineup number.
check(
  'highest icetime wins when games have been played',
  getTopLine('OTT', LINES)?.name,
  'Tkachuk-Cozens-Giroux',
);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
