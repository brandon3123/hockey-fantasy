'use client';

import { useMemo } from 'react';
import { DraftPickRow, ParticipantData, DraftData } from '@/hooks/useDraftState';
import { Player } from '@/types/player';
import TeamLogo from './TeamLogo';

interface MyTeamTabProps {
  picks: DraftPickRow[];
  participants: ParticipantData[];
  players: Player[];
  currentUserId: string | null;
  draft: DraftData;
  currentRound: number;
  currentPick: number;
  managers: number;
}

export default function MyTeamTab({
  picks,
  participants,
  players,
  currentUserId,
  draft,
  currentRound,
  currentPick,
  managers,
}: MyTeamTabProps) {
  const myParticipant = useMemo(
    () => participants.find((p) => p.user_id === currentUserId),
    [participants, currentUserId]
  );

  const myPicks = useMemo(
    () =>
      myParticipant
        ? picks
            .filter((p) => p.participant_id === myParticipant.id)
            .sort((a, b) => a.round - b.round)
        : [],
    [picks, myParticipant]
  );

  const positionBreakdown = useMemo(() => {
    const counts: Record<string, number> = { C: 0, LW: 0, RW: 0, D: 0 };
    myPicks.forEach((pick) => {
      const player = players.find((p) => p.name === pick.player_name);
      if (player) counts[player.position] = (counts[player.position] || 0) + 1;
    });
    return counts;
  }, [myPicks, players]);

  const teamStacks = useMemo(() => {
    const stacks: Record<string, number> = {};
    myPicks.forEach((pick) => {
      const player = players.find((p) => p.name === pick.player_name);
      if (player) stacks[player.team] = (stacks[player.team] || 0) + 1;
    });
    return Object.entries(stacks)
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a);
  }, [myPicks, players]);

  const totalProjected = useMemo(
    () =>
      myPicks.reduce((total, pick) => {
        const player = players.find((p) => p.name === pick.player_name);
        return total + (player?.displayPoints || 0);
      }, 0),
    [myPicks, players]
  );

  const nextPickInfo = useMemo(() => {
    if (!myParticipant || !myParticipant.draft_position) return null;
    const myPos = myParticipant.draft_position;
    const playersPerTeam = draft.players_per_team;

    for (let round = currentRound; round <= playersPerTeam; round++) {
      const isReverse = round % 2 === 0;
      const posInRound = isReverse ? managers - myPos + 1 : myPos;
      const overallPick = (round - 1) * managers + posInRound;
      const currentOverall = (currentRound - 1) * managers + currentPick;

      if (overallPick >= currentOverall) {
        const picksAway = overallPick - currentOverall;
        return { round, pickInRound: posInRound, picksAway };
      }
    }
    return null;
  }, [myParticipant, currentRound, currentPick, managers, draft.players_per_team]);

  if (!myParticipant) {
    return (
      <div className="p-6 text-center text-[#5a6b57]">
        You are not a participant in this draft
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#c8d9c3]">
            {myParticipant.team_name}
          </h3>
          <div className="text-sm text-[#5a6b57]">
            {myPicks.length} / {draft.players_per_team} picks
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#6b9b7a]">
            {totalProjected.toFixed(1)}
          </div>
          <div className="text-xs text-[#5a6b57]">projected pts</div>
        </div>
      </div>

      <div className="flex gap-2">
        {Object.entries(positionBreakdown).map(([pos, count]) => (
          <div
            key={pos}
            className="flex-1 bg-[#0a0f0a] border border-[#141e12] rounded p-2 text-center"
          >
            <div className="text-xs text-[#5a6b57]">{pos}</div>
            <div className="text-sm font-bold text-[#c8d9c3]">{count}</div>
          </div>
        ))}
      </div>

      {teamStacks.length > 0 && (
        <div className="bg-[#0a0f0a] border border-[#141e12] rounded p-3">
          <div className="text-xs text-[#5a6b57] mb-1">Team Stacks</div>
          <div className="flex gap-2 flex-wrap">
            {teamStacks.map(([team, count]) => (
              <span
                key={team}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1a2f1a] text-[#6b9b7a] text-xs font-semibold rounded"
              >
                {team}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {nextPickInfo && (
        <div className="bg-[#0a0f0a] border border-[#141e12] rounded p-3">
          <div className="text-xs text-[#5a6b57]">Next Pick</div>
          <div className="text-sm text-[#c8d9c3]">
            {nextPickInfo.picksAway === 0
              ? "Your turn!"
              : `Round ${nextPickInfo.round} — ${nextPickInfo.picksAway} pick${nextPickInfo.picksAway !== 1 ? 's' : ''} away`}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {myPicks.map((pick) => {
          const player = players.find((p) => p.name === pick.player_name);
          return (
            <div
              key={pick.id}
              className="flex items-center gap-3 p-3 bg-[#0a0f0a] border border-[#141e12] rounded"
            >
              <div className="w-8 h-8 rounded bg-[#141e12] flex items-center justify-center text-xs font-bold text-[#5a6b57]">
                R{pick.round}
              </div>
              {player && <TeamLogo team={player.team} className="w-8 h-8" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#c8d9c3] truncate">
                  {pick.player_name}
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {player ? `${player.team} • ${player.position}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[#6b9b7a]">
                  {player?.displayPoints.toFixed(1) || '-'}
                </div>
              </div>
            </div>
          );
        })}

        {myPicks.length === 0 && (
          <div className="text-center text-[#5a6b57] text-sm py-6">
            No picks yet
          </div>
        )}
      </div>
    </div>
  );
}
