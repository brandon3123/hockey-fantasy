/**
 * Permanent test: participants + picks → legacy DraftState binding.
 *
 * The /draft room and the coach page both render hosted drafts through this
 * mapping; a regression here breaks every bound draft view.
 *
 * Run from app/: npx tsx scripts/test-bind-draft-state.ts
 */
import { managerNamesFrom, toLegacyDraftState } from '../src/lib/bind-draft-state';
import type { Player } from '../src/types/player';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const mcdavid: Player = {
  name: 'Connor McDavid', team: 'EDM', position: 'C',
  regularSeasonGoals: 0, regularSeasonAssists: 0, gamesPlayed: 0, pointsPerGame: 1.68,
  teamAdvancementOdds: null as never, projectedPlayoffGames: 0, projectedPlayoffPoints: 0,
  gamesRemaining: 82, projectedPoints: 138, displayPoints: 138, displayGames: 82, rank: 2,
  injury: { status: 'healthy', expectedReturn: null, description: null },
};
const players = [mcdavid];

const participants = [
  { id: 'seat-b', team_name: "B's Team", draft_position: 1 },
  { id: 'seat-k', team_name: 'Kevin', draft_position: 2 },
  { id: 'seat-null', team_name: 'Late Add', draft_position: null },
];
const picks = [
  { player_id: 'connor-mcdavid-edm-c', player_name: 'Connor McDavid', round: 1, participant_id: 'seat-k' },
];

const state = toLegacyDraftState(
  { players_per_team: 5, current_round: 2, current_pick: 1 },
  participants, picks, players, 2, 'seat-b',
);

check('managers counted from participant rows (null position still a seat)', state.managers, 3);
check('picks replayed with participant ids', state.picks, [
  { playerId: 'connor-mcdavid-edm-c', playerName: 'Connor McDavid', round: 1, participantId: 'seat-k' },
]);
check('clock passthrough', { r: state.currentRound, p: state.currentPick }, { r: 2, p: 1 });
check('yourParticipantId is the admin seat', state.yourParticipantId, 'seat-b');
check('playersPerTeam passthrough', state.playersPerTeam, 5);

check('manager names ordered by draft position, nulls last',
  managerNamesFrom(participants), ["B's Team", 'Kevin', 'Late Add']);
check('names fall back to Team N for empty names', managerNamesFrom([
  { id: 'a', team_name: '', draft_position: 2 },
  { id: 'b', team_name: 'X', draft_position: 1 },
]), ['X', 'Team 2']);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
