'use client';

import { useState, useMemo } from 'react';
import { Player } from '@/types/player';
import { ParticipantData } from '@/hooks/useDraftState';
import TeamLogo from './TeamLogo';
import InjuryFlag from './InjuryFlag';

interface LivePlayerSidebarProps {
  availablePlayers: Player[];
  currentParticipant: ParticipantData | null;
  participants: ParticipantData[];
  isDraftComplete: boolean;
  pickTimerSeconds: number | null;
  onPickPlayer: (player: Player) => void;
  loading: boolean;
}

export default function LivePlayerSidebar({
  availablePlayers,
  currentParticipant,
  participants,
  isDraftComplete,
  pickTimerSeconds,
  onPickPlayer,
  loading,
}: LivePlayerSidebarProps) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  const filteredPlayers = useMemo(() => {
    let result = [...availablePlayers];
    if (positionFilter !== 'ALL') {
      result = result.filter((p) => p.position === positionFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q)
      );
    }
    return result;
  }, [availablePlayers, positionFilter, search]);

  const positions = ['ALL', 'C', 'LW', 'RW', 'D'];

  return (
    <div className="flex-1 flex flex-col bg-[#050a05] min-h-0">
      <div className="p-4 border-b border-[#141e12] bg-[#0a0f0a]">
        <div className="text-sm font-semibold text-[#5a6b57] mb-1">
          PICKING FOR
        </div>
        <div className="text-lg font-bold text-[#c8d9c3]">
          {isDraftComplete
            ? 'Draft Complete!'
            : currentParticipant?.team_name || 'Waiting...'}
        </div>
        {pickTimerSeconds && !isDraftComplete && (
          <div className="text-xs text-[#5a6b57] mt-1">
            {pickTimerSeconds}s per pick
          </div>
        )}
      </div>

      <div className="p-3 border-b border-[#141e12]">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-[#141e12] rounded-lg bg-[#0a0f0a] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
        />
      </div>

      <div className="flex gap-1 p-2 border-b border-[#141e12]">
        {positions.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded transition-colors ${
              positionFilter === pos
                ? 'bg-[#4a7c59] text-[#c8d9c3]'
                : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[#5a6b57] text-sm">
            Loading players...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-4 text-center text-[#5a6b57] text-sm">
            No players found
          </div>
        ) : (
          filteredPlayers.map((player, index) => (
            <div
              key={player.name}
              onClick={() => {
                if (!isDraftComplete) onPickPlayer(player);
              }}
              className={`flex items-center gap-3 p-3 border-b border-[#141e12] transition-colors ${
                isDraftComplete
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-[#0a0f0a]'
              } ${index === 0 ? 'bg-[#0a0f0a] border-l-2 border-l-[#4a7c59]' : ''}`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                  index === 0
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'bg-[#141e12] text-[#5a6b57]'
                }`}
              >
                #{player.rank}
              </div>
              <TeamLogo team={player.team} className="w-8 h-8 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[#c8d9c3] truncate">
                    {player.name}
                  </span>
                  <InjuryFlag player={player} />
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {player.team} &bull; {player.position}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-[#6b9b7a]">
                  {player.projectedPlayoffPoints.toFixed(1)}
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {player.projectedPlayoffGames.toFixed(1)} gp
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
