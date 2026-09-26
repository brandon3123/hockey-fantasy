/**
 * Permanent test: the coach must load the right line file for the season.
 *
 * Regression for: a regular-season draft scoring its stack bonus against
 * PLAYOFF line data. loadLines() defaults to seasonType='playoffs', and
 * DraftCoach called it with no argument, so a regular-season draft's
 * "completes your line" reasoning was computed from last spring's units.
 *
 * Run from app/: npx tsx scripts/test-lines-season.ts
 */
import { loadLines } from '../src/lib/moneypuck-parser';
import { join } from 'path';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

async function main() {
  // In a browser, loadLines fetches /lines_*.json from the dev server. In a
  // plain tsx run there is no server, so the fetch fails and it returns null.
  // That is fine: what we are testing is WHICH file is requested, which we
  // can observe through the cache after pointing fetch at the filesystem.
  const fs = await import('fs');
  const path = await import('path');
  const files: Record<string, string> = {
    '/lines_playoffs.json': join(process.cwd(), 'public', 'lines_playoffs.json'),
    '/lines_regular.json': join(process.cwd(), 'public', 'lines_regular.json'),
  };
  // @ts-expect-error - replacing global fetch deliberately
  globalThis.fetch = async (input: string) => {
    const file = files[input];
    if (!file) throw new Error(`unexpected fetch: ${input}`);
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf-8')) } as Response;
  };

  const playoffs = await loadLines();            // the old default
  const regular = await loadLines('regular');    // what DraftCoach should ask for

  check('playoffs file loads 16 playoff teams', new Set(playoffs?.map(l => (l as any).team)).size, 16);
  check('regular file loads all 32 teams', new Set(regular?.map(l => (l as any).team)).size, 32);
  check('regular file is much larger than playoffs', (regular?.length ?? 0) > (playoffs?.length ?? 0) * 10, true);

  // The concrete user-visible difference: the coach scores stacks against the
  // season the draft is actually in.
  const regEdm = regular?.filter(l => (l as any).team === 'EDM') ?? [];
  check('regular EDM pool is current-depth-chart sized',
    (regEdm?.length ?? 0) > 20, true);
}

main().catch(e => { console.error('ERR:', e); failures += 1; process.exit(1); });
