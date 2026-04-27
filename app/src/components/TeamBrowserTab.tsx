'use client';

import { useState, useMemo } from 'react';
import { Player } from '@/types/player';
import { DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import TeamLogo from './TeamLogo';
import InjuryFlag, { isPlayerPickable } from './InjuryFlag';

interface TeamBrowserTabProps {
  players: Player[];
  picks: DraftPickRow[];
  participants: ParticipantData[];
  onDraftPlayer?: (player: Player) => void;
  isDraftComplete: boolean;
}

export default function TeamBrowserTab({
  players,
  picks,
  participants,
  onDraftPlayer,
  isDraftComplete,
}: TeamBrowserTabProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const teams = useMemo(() => {
    const teamSet = new Set<string>();
    players.forEach((p) => teamSet.add(p.team));
    return Array.from(teamSet).sort();
  }, [players]);

  const draftedPlayerNames = useMemo(
    () => new Set(picks.map((p) => p.player_name)),
    [picks]
  );

  const pickOwnerMap = useMemo(() => {
    const map = new Map<string, string>();
    picks.forEach((pick) => {
      const participant = participants.find((p) => p.id === pick.participant_id);
      if (participant) map.set(pick.player_name, participant.team_name);
    });
    return map;
  }, [picks, participants]);

  const teamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return players
      .filter((p) => p.team === selectedTeam)
      .sort((a, b) => b.displayPoints - a.displayPoints);
  }, [players, selectedTeam]);

  const teamAdvancementOdds = useMemo(() => {
    if (!selectedTeam) return null;
    const first = players.find((p) => p.team === selectedTeam);
    return first?.teamAdvancementOdds || null;
  }, [players, selectedTeam]);

  const availableCount = selectedTeam
    ? teamPlayers.filter((p) => !draftedPlayerNames.has(p.name)).length
    : 0;
  const draftedCount = selectedTeam
    ? teamPlayers.filter((p) => draftedPlayerNames.has(p.name)).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {teams.map((team) => (
          <button
            key={team}
            onClick={() => setSelectedTeam(selectedTeam === team ? null : team)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
              selectedTeam === team
                ? 'bg-[#1a2f1a] border-2 border-[#4a7c59]'
                : 'bg-[#0a0f0a] border border-[#141e12] hover:border-[#4a7c59]'
            }`}
          >
            <TeamLogo team={team} className="w-8 h-8" />
            <span className="text-[10px] text-[#5a6b57] font-semibold">
              {team}
            </span>
          </button>
        ))}
      </div>

      {selectedTeam && (
        <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#141e12]">
            <div className="flex items-center gap-3">
              <TeamLogo team={selectedTeam} className="w-10 h-10" />
              <div>
                <div className="text-lg font-bold text-[#c8d9c3]">
                  {selectedTeam}
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {availableCount} available, {draftedCount} drafted
                </div>
              </div>
              {teamAdvancementOdds && (
                <div className="ml-auto flex gap-1">
                  {Object.entries(teamAdvancementOdds).map(([round, odds]) => {
                    const pct = odds * 100;
                    const label = round.replace('round', 'R');
                    return (
                      <span
                        key={round}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          pct >= 60
                            ? 'bg-[#1a3d1a] text-[#6b9b7a]'
                            : pct >= 40
                            ? 'bg-[#3d3a1a] text-[#9b8f6b]'
                            : 'bg-[#3d1a1a] text-[#9b6b6b]'
                        }`}
                      >
                        {label} {pct.toFixed(0)}%
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-[#141e12]">
            {teamPlayers.map((player) => {
              const isDrafted = draftedPlayerNames.has(player.name);
              const owner = pickOwnerMap.get(player.name);

              return (
                <div
                  key={player.name}
                  onClick={() => {
                    if (!isDrafted && onDraftPlayer && !isDraftComplete && isPlayerPickable(player)) {
                      onDraftPlayer(player);
                    }
                  }}
                  className={`flex items-center gap-3 p-3 ${
                    isDrafted
                      ? 'opacity-50'
                      : !isPlayerPickable(player)
                      ? 'opacity-40 cursor-not-allowed'
                      : onDraftPlayer && !isDraftComplete
                      ? 'cursor-pointer hover:bg-[#050a05]'
                      : ''
                  }`}
                >
                  <div className="w-6 text-center">
                    <span className="text-xs text-[#5a6b57] font-semibold">
                      #{player.rank}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-[#c8d9c3] truncate">
                        {player.name}
                      </span>
                      <InjuryFlag player={player} />
                    </div>
                    <div className="text-xs text-[#5a6b57]">
                      {player.position} &bull; {player.regularSeasonGoals}G{' '}
                      {player.regularSeasonAssists}A
                    </div>
                  </div>
                  <div className="text-right">
                    {isDrafted && owner ? (
                      <span className="text-xs px-2 py-0.5 bg-[#141e12] text-[#5a6b57] rounded">
                        {owner}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-[#6b9b7a]">
                        {player.displayPoints.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {teamPlayers.length === 0 && (
              <div className="p-4 text-center text-[#5a6b57] text-sm">
                No players found for {selectedTeam}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
