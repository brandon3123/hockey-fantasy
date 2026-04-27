'use client';

import { Player } from '@/types/player';
import { cn, isInjured } from '@/lib/utils';
import InjuryFlag, { isPlayerPickable } from './InjuryFlag';
import TeamLogo from './TeamLogo';
import WatchlistToggle from './WatchlistToggle';
import { useState } from 'react';

interface FullPlayerListProps {
  availablePlayers: Player[];
  currentPick: number;
  onDraftPlayer: (player: Player) => void;
  watchlist?: Set<string>;
  onToggleWatchlist?: (playerName: string) => void;
  draftComplete?: boolean;
}

export default function FullPlayerList({
  availablePlayers,
  currentPick,
  onDraftPlayer,
  watchlist = new Set(),
  onToggleWatchlist,
  draftComplete = false
}: FullPlayerListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');

  const filtered = availablePlayers
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.team.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPosition = positionFilter === 'ALL' || p.position === positionFilter;
      return matchesSearch && matchesPosition;
    })
    .sort((a, b) => b.displayPoints - a.displayPoints);

  const positions = ['ALL', 'C', 'LW', 'RW', 'D', 'G'];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h3 className="text-lg font-bold mb-2 text-[#c8d9c3]">
            Player List
          </h3>
          <div className="group relative">
            <button className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#6b9b7a] text-[#050a05] text-[10px] font-semibold cursor-help hover:bg-[#8ab89a] transition-colors">
              i
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#8ab89a] text-[#050a05] text-xs rounded-lg shadow-xl border border-[#6b9b7a] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ zIndex: 10000 }}>
              <div className="font-semibold mb-2">Stats Legend:</div>
              <div className="space-y-1">
                <div><strong>proj</strong> - Projected playoff points</div>
                <div><strong>gp</strong> - Projected games played</div>
                <div><strong>ppg</strong> - Points per game</div>
                <div><strong>ADP</strong> - Average draft position</div>
              </div>
              {/* Arrow */}
              <div className="absolute top-full right-4 -mt-1 w-2 h-2 bg-[#8ab89a] border-r border-b border-[#6b9b7a] transform rotate-45"></div>
            </div>
          </div>
        </div>
        <div className="w-full h-px bg-[#141e12]"></div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search players..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-[#141e12] rounded-lg bg-[#050a05] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
        />

        <div className="flex gap-2 flex-wrap">
          {positions.map(pos => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`px-3 py-1 text-sm font-semibold rounded-lg transition-colors ${
                positionFilter === pos
                  ? 'bg-[#4a7c59] text-[#c8d9c3]'
                  : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="bg-[#0a0f0a] p-3 text-center rounded-lg border border-[#141e12]">
        <div className="text-sm text-[#5a6b57] font-medium">
          Showing {filtered.length} of {availablePlayers.length} players
        </div>
      </div>

      {/* Player Grid */}
      <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto p-2 bg-[#0a0f0a] rounded-lg border border-[#141e12]">
        {filtered.slice(0, 50).map((player) => (
          <div
            key={player.name}
            onClick={(e) => {
              if (draftComplete || !isPlayerPickable(player)) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              onDraftPlayer(player);
            }}
            className={`p-3 bg-[#050a05] border border-[#141e12] rounded-lg hover:border-[#4a7c59] hover:bg-[#0a0f0a] transition-all ${
              draftComplete ? 'opacity-50' : !isPlayerPickable(player) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Rank */}
              <div className="text-xs text-[#5a6b57] font-semibold w-12 shrink-0">
                #{player.rank}
              </div>

              {/* Watchlist */}
              {onToggleWatchlist && (
                <div className="shrink-0">
                  <WatchlistToggle
                    playerName={player.name}
                    isWatched={watchlist.has(player.name)}
                    onToggle={onToggleWatchlist}
                  />
                </div>
              )}

              <TeamLogo team={player.team} className="w-8 h-8" />

              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#c8d9c3] truncate">
                    {player.name}
                  </span>
                  <InjuryFlag player={player} />
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {player.team} &bull; {player.position}
                </div>
              </div>

              {/* Stats */}
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-[#6b9b7a]">
                  {player.displayPoints.toFixed(1)}
                  <span className="text-xs font-normal text-[#5a6b57] ml-1">proj</span>
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {player.displayGames.toFixed(1)} gp
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {player.pointsPerGame.toFixed(2)} ppg
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 50 && (
        <div className="bg-[#0a0f0a] p-3 text-center rounded-lg border border-[#141e12]">
          <div className="text-xs text-[#5a6b57]">
            Showing first 50 of {filtered.length} results
          </div>
        </div>
      )}
    </div>
  );
}