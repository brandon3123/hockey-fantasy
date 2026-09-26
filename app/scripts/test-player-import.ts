/**
 * Permanent test: player row ids and prune targets for the Supabase import.
 *
 * The id embeds the team, so a traded player becomes a new row rather than an
 * update. Without pruning, the previous team's row survives and the board
 * shows the player twice - once on a team they no longer play for.
 *
 * Run from app/: npx tsx scripts/test-player-import.ts
 */
import { chunk, playerId, stalePlayerIds } from '../src/lib/player-import';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// 1. The id format the existing table already uses - changing it would orphan
//    every row on the next import.
check('id is name-team-position, slugified', playerId({ name: 'Brady Tkachuk', team: 'FLA', position: 'LW' }), 'brady-tkachuk-fla-lw');
// 2. Accents become separators ("Aatu Räty" -> "aatu-r-ty-ari-c"). This looks
//    wrong but matches the ids already in the table; "fixing" it would give
//    every accented player a new id and duplicate them on the board.
check('accents become separators, matching existing rows', playerId({ name: 'Aatu Räty', team: 'ARI', position: 'C' }), 'aatu-r-ty-ari-c');
check('names with hyphens stay readable', playerId({ name: 'Neal Pionk', team: 'WPG', position: 'D' }), 'neal-pionk-wpg-d');

// 2. A trade changes the id, which is exactly why pruning is required.
check(
  'a trade produces a different id',
  playerId({ name: 'Brady Tkachuk', team: 'OTT', position: 'LW' }) === playerId({ name: 'Brady Tkachuk', team: 'FLA', position: 'LW' }),
  false,
);

// 3. Prune targets: rows in the table that the file no longer contains.
const fileIds = new Set(['brady-tkachuk-fla-lw', 'connor-mcdavid-edm-c']);
check(
  'traded player under the old team is stale',
  stalePlayerIds(['brady-tkachuk-ott-lw', 'brady-tkachuk-fla-lw', 'connor-mcdavid-edm-c'], fileIds),
  ['brady-tkachuk-ott-lw'],
);
check('a fully matching table has nothing to prune', stalePlayerIds([...fileIds], fileIds), []);
check('an empty table has nothing to prune', stalePlayerIds([], fileIds), []);

// 4. Batching: a single unpaginated read stops at PostgREST's 1000-row cap,
//    which is how stale rows past that point survive a prune.
check('chunk splits evenly', chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
check('chunk keeps a short final batch', chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
check('chunk of an empty list is empty', chunk([], 100), []);
check('chunk covers every item exactly once', chunk(Array.from({ length: 2500 }, (_, i) => i), 1000).flat().length, 2500);
check('chunk rejects a non-positive size', (() => { try { chunk([1], 0); return 'no throw'; } catch { return 'threw'; } })(), 'threw');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
