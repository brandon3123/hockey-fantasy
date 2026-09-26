/**
 * Bind a hosted draft's Supabase rows to the legacy DraftState shape that
 * /draft and the draft-coach components render from.
 */
import type { DraftState, Player } from '@/types/player';

export interface BoundDraftInfo {
  players_per_team: number;
  current_round: number;
  current_pick: number;
}

export interface BoundParticipant {
  id: string;
  team_name: string;
  draft_position: number | null;
}

export interface BoundPick {
  player_id: string;
  player_name: string;
  round: number;
  participant_id: string;
}

export function toLegacyDraftState(
  draft: BoundDraftInfo,
  participants: BoundParticipant[],
  picks: BoundPick[],
  availablePlayers: Player[],
  adminPosition: number,
  adminParticipantId: string,
): DraftState {
  const legacyPicks = picks.map((p) => ({
    playerId: p.player_id,
    playerName: p.player_name,
    round: p.round,
    participantId: p.participant_id,
  }));

  return {
    managers: participants.length,
    yourPosition: adminPosition,
    yourParticipantId: adminParticipantId,
    playersPerTeam: draft.players_per_team,
    currentRound: draft.current_round,
    currentPick: draft.current_pick,
    picks: legacyPicks,
    availablePlayers,
  };
}

/** Seat names in draft order (null positions last, stable); blanks fall back to Team N. */
export function managerNamesFrom(participants: BoundParticipant[]): string[] {
  const ordered = [...participants].sort((a, b) => {
    const ap = a.draft_position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.draft_position ?? Number.MAX_SAFE_INTEGER;
    return ap - bp;
  });
  return ordered.map((p, i) => p.team_name?.trim() || `Team ${i + 1}`);
}
