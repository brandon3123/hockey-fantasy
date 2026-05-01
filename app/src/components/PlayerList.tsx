'use client';

import { useState, useMemo } from 'react';
import { Player } from '@/types/player';
import { ParticipantData } from '@/hooks/useDraftState';
import TeamLogo from './TeamLogo';
import InjuryFlag, { isPlayerPickable } from './InjuryFlag';

interface PlayerListProps {
  availablePlayers: Player[];
  onPickPlayer?: (player: Player) => void;
  loading?: boolean;
  picking?: boolean;
  isDraftComplete?: boolean;
  currentParticipant?: ParticipantData | null;
  pickTimerSeconds?: number | null;
  showSearch?: boolean;
  showHeader?: boolean;
  maxPlayers?: number;
}

export default function PlayerList({
  availablePlayers,
  onPickPlayer,
  loading = false,
  picking = false,
  isDraftComplete = false,
  currentParticipant = null,
  pickTimerSeconds = null,
  showSearch = true,
  showHeader = false,
  maxPlayers,
}: PlayerListProps) {
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
    if (maxPlayers) {
      result = result.slice(0, maxPlayers);
    }
    return result;
  }, [availablePlayers, positionFilter, search, maxPlayers]);

  const positions = ['ALL', 'C', 'LW', 'RW', 'D'];

  const canPick = !!onPickPlayer && !isDraftComplete;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {showHeader && (
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
      )}

      {showSearch && (
        <>
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
                className={`flex-1 px-2 py-2.5 text-xs font-semibold rounded transition-colors ${
                  positionFilter === pos
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto relative">
        {picking && (
          <div className="absolute inset-0 bg-[#050a05]/80 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#4a7c59] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#6b9b7a]">Making pick...</span>
            </div>
          </div>
        )}
        {loading ? (
          <div className="p-4 text-center text-[#5a6b57] text-sm">
            Loading players...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-4 text-center text-[#5a6b57] text-sm">
            No players found
          </div>
        ) : (
          filteredPlayers.map((player, index) => {
            const pickable = canPick && isPlayerPickable(player);
            return (
              <div
                key={`${player.name}-${player.team}-${player.position}`}
                onClick={() => {
                  if (pickable) onPickPlayer!(player);
                }}
                className={`flex items-center gap-3 p-3 border-b border-[#141e12] transition-colors ${
                  isDraftComplete
                    ? 'opacity-50 cursor-not-allowed'
                    : !isPlayerPickable(player)
                    ? 'opacity-40 cursor-not-allowed'
                    : pickable
                    ? 'cursor-pointer hover:bg-[#0a0f0a]'
                    : 'cursor-default'
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
                    {player.team} &bull; {player.position} &bull; {player.pointsPerGame.toFixed(2)} ppg
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-[#6b9b7a]">
                    {player.displayPoints.toFixed(1)}
                  </div>
                  <div className="text-xs text-[#5a6b57]">
                    pts
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
