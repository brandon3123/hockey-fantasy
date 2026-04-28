'use client';

import { useMemo } from 'react';
import { DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import { Player } from '@/types/player';
import TeamLogo from './TeamLogo';

interface DraftBoardProps {
  participants: ParticipantData[];
  picks: DraftPickRow[];
  players: Player[];
  playersPerTeam: number;
  currentRound: number;
  currentParticipant: ParticipantData | null;
}

export default function DraftBoard({
  participants,
  picks,
  players,
  playersPerTeam,
  currentRound,
  currentParticipant,
}: DraftBoardProps) {
  const sorted = useMemo(
    () => [...participants].sort((a, b) => (a.draft_position ?? 0) - (b.draft_position ?? 0)),
    [participants]
  );

  return (
    <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#4a7c59] text-[#c8d9c3]">
              <th className="px-2 py-1.5 text-left font-semibold border-r border-[#3d664a] whitespace-nowrap">
                MGR
              </th>
              {Array.from({ length: playersPerTeam }, (_, i) => (
                <th key={i} className="px-1 py-1.5 text-center font-semibold border-r border-[#3d664a] min-w-[50px]">
                  R{i + 1}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center font-semibold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((participant) => {
              const isCurrent = currentParticipant?.id === participant.id;
              const pts = picks
                .filter((p) => p.participant_id === participant.id)
                .reduce((total, pick) => {
                  const player = players.find((pl) => pl.name === pick.player_name);
                  return total + (player?.displayPoints || 0);
                }, 0);
              return (
                <tr key={participant.id} className={`border-b border-[#141e12] ${isCurrent ? 'bg-[#2a4a2a]' : 'bg-[#050a05]'}`}>
                  <td className="px-2 py-1 border-r border-[#141e12]">
                    <span className={`text-[10px] font-semibold ${isCurrent ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                      {participant.team_name}
                    </span>
                  </td>
                  {Array.from({ length: playersPerTeam }, (_, roundIndex) => {
                    const round = roundIndex + 1;
                    const pick = picks.find((p) => p.participant_id === participant.id && p.round === round);
                    const isCell = isCurrent && round === currentRound;
                    const player = pick ? players.find((pl) => pl.name === pick.player_name) : null;
                    return (
                      <td key={roundIndex} className={`px-0.5 py-0.5 border-r border-[#141e12] text-center ${isCell ? 'bg-[#1a2f1a]' : ''}`}>
                        {pick ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-[10px] text-[#c8d9c3] truncate max-w-[50px]">
                              {pick.player_name.split(' ').pop()}
                            </span>
                            {player && (
                              <TeamLogo team={player.team} className="w-3 h-3" />
                            )}
                          </div>
                        ) : isCell ? (
                          <div className="text-[10px] text-[#6b9b7a] animate-pulse font-semibold">Picking...</div>
                        ) : (
                          <span className="text-[#2d3c28]">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    <span className="text-[10px] font-bold text-[#6b9b7a]">
                      {pts > 0 ? pts.toFixed(1) : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
