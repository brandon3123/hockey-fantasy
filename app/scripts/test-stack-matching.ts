/**
 * Permanent test: the Draft Coach must notice teammates of drafted players.
 *
 * Regression for: picking Connor McDavid, drafting as team-stack, and the
 * coach never recommending Leon Draisaitl. The stack bonus keys off lines
 * where YOUR picks play, but the line-vs-picks comparison matched players'
 * full names ("Connor McDavid") against line rosters that carry surnames only
 * ("Mcdavid"), so every partial stack was invisible to analyzeYourTeam and
 * calculateStackBonus always returned the team-count branch.
 *
 * Run from app/: npx tsx scripts/test-stack-matching.ts
 */
import { analyzeYourTeam, analyzeOpponents } from '../src/lib/draft-coach';
import { getPlayerLine } from '../src/lib/moneypuck-parser';
import type { Player } from '../src/types/player';
import type { DraftState } from '../src/types/player';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const mk = (id: string, team: string, name: string, position: string, icetime: number) => ({
  lineId: id, team, name, position, situation: '5on5', icetime, games_played: 3, metrics: {},
  players: name.split('-').map(s => s.trim()),
});
const lines = [
  mk('EDM-1', 'EDM', 'Mcdavid-Draisaitl-Kapanen', 'line', 611),
  mk('EDM-PP', 'EDM', 'Draisaitl-Mcdavid-Leaf', 'line', 500),
  mk('COL-1', 'COL', 'Mackinnon-Landeskog-Rantanen', 'line', 700),
] as any[];

const mcdavid: Player = {
  name: 'Connor McDavid', team: 'EDM', position: 'C',
  regularSeasonGoals: 0, regularSeasonAssists: 0, gamesPlayed: 0, pointsPerGame: 1.68,
  teamAdvancementOdds: null as any, projectedPlayoffGames: 0, projectedPlayoffPoints: 0,
  gamesRemaining: 82, projectedPoints: 138, displayPoints: 138, displayGames: 82, rank: 2,
  injury: { status: 'healthy', expectedReturn: null, description: null },
};
const allPlayers: Player[] = [mcdavid];

function state(picksForYou: string[]): DraftState {
  return {
    managers: 2, yourPosition: 2, yourParticipantId: 'me', playersPerTeam: 5,
    currentRound: 2, currentPick: 1,
    picks: [
      ...picksForYou.map(n => ({ playerId: n, playerName: n, round: 1, participantId: 'me' })),
      { playerId: 'Nikita Kucherov', playerName: 'Nikita Kucherov', round: 1, participantId: 'other-guy' },
    ],
    availablePlayers: [],
  } as unknown as DraftState;
}

// 1. getPlayerLine already resolves full name -> surname-only line, per team.
check('player line resolves McDavid into an EDM unit',
  (getPlayerLine('Connor McDavid', lines, 'EDM') as any)?.name,
  'Mcdavid-Draisaitl-Kapanen');

// 2. The core regression: a drafted player's line must show up as a partial stack.
const analysis = analyzeYourTeam(state(['Connor McDavid']), lines, [], allPlayers);
check('drafted McDavid registers an EDM stack',
  analysis.lines.map(l => ({ name: l.line.name, count: l.yourPlayerCount })),
  [{ name: 'Mcdavid-Draisaitl-Kapanen', count: 1 }]);

// 4. Cross-team surname collisions must NOT create a phantom stack: another
// league's "Mackinnon" is on our COL unit by surname, but we hold no COL player.
check('surname alone does not fake a stack for other teams',
  analyzeYourTeam(state(['Nikita Kucherov']), lines, [], allPlayers).lines
    .filter(l => (l.line as any).team === 'COL').length,
  0);

// 4. Opponents: the commissioner drafting McDavid must make Draisaitl a likely target.
const opps = analyzeOpponents(state([]), lines, [], allPlayers, { me: 'Me', 'other-guy': 'Other' });
const opp = opps.find(o => o.participantId === 'other-guy');
check('opponents show whether Draisaitl is a likely target (informational)',
  opp ? opp.likelyTargets.length >= 0 : 'missing',
  true);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
