'use client';

import { useState, useMemo } from 'react';
import { Player } from '@/types/player';
import InjuryFlag from './InjuryFlag';
import WatchlistToggle from './WatchlistToggle';
import TeamLogo from './TeamLogo';

interface PlayerTableProps {
  players: Player[];
  watchlist?: Set<string>;
  onToggleWatchlist?: (playerName: string) => void;
}

type SortField = 'rank' | 'name' | 'team' | 'position' | 'pointsPerGame' | 'projectedPlayoffPoints' | 'adp';
type SortOrder = 'asc' | 'desc';

export default function PlayerTable({ players, watchlist = new Set(), onToggleWatchlist }: PlayerTableProps) {
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const teams = useMemo(() => {
    return Array.from(new Set(players.map(p => p.team))).sort();
  }, [players]);

  const filteredPlayers = useMemo(() => {
    return players
      .filter(p => {
        if (positionFilter !== 'all' && p.position !== positionFilter) return false;
        if (teamFilter !== 'all' && p.team !== teamFilter) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return p.name.toLowerCase().includes(query) || p.team.toLowerCase().includes(query);
        }
        return true;
      })
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal === undefined || bVal === undefined) return 0;

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [players, sortField, sortOrder, positionFilter, teamFilter, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-[#0a0f0a] rounded-lg border border-[#141e12]">
        <div>
          <label htmlFor="position-filter" className="block text-sm font-medium mb-1 text-[#c8d9c3]">
            Position
          </label>
          <select
            id="position-filter"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
          >
            <option value="all">All</option>
            <option value="C">Center</option>
            <option value="LW">Left Wing</option>
            <option value="RW">Right Wing</option>
            <option value="D">Defense</option>
          </select>
        </div>

        <div>
          <label htmlFor="team-filter" className="block text-sm font-medium mb-1 text-[#c8d9c3]">
            Team
          </label>
          <select
            id="team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
          >
            <option value="all">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search" className="block text-sm font-medium mb-1 text-[#c8d9c3]">
            Search
          </label>
          <input
            id="search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Player name or team..."
            className="px-3 py-2 border border-[#141e12] rounded-md w-64 bg-[#050a05] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
          />
        </div>

        <div className="ml-auto flex items-end">
          <span className="text-sm text-[#5a6b57]">
            Showing {filteredPlayers.length} of {players.length} players
          </span>
        </div>
      </div>

      {/* Player Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPlayers.slice(0, 32).map((player) => (
          <div
            key={player.name}
            className="bg-[#0a0f0a] rounded-lg p-4 hover:border-[#4a7c59] transition-all border border-[#141e12]"
          >
            {/* Header with Rank and Team Logo */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-[#6b9b7a]">
                  #{player.rank}
                </div>
                <TeamLogo team={player.team} className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2">
                <WatchlistToggle
                  playerName={player.name}
                  isWatched={watchlist.has(player.name)}
                  onToggle={onToggleWatchlist}
                />
              </div>
            </div>

            {/* Player Info */}
            <div className="space-y-2">
              <div>
                <div className="font-semibold text-lg text-[#c8d9c3] flex items-center gap-2">
                  {player.name}
                  <InjuryFlag player={player} />
                </div>
                <div className="text-sm text-[#5a6b57]">
                  {player.team} • {player.position}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#141e12]">
                <div className="text-center">
                  <div className="text-xs text-[#5a6b57]">PPG</div>
                  <div className="font-semibold text-[#c8d9c3]">{player.pointsPerGame.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[#5a6b57]">PROJ PTS</div>
                  <div className="font-bold text-[#6b9b7a]">{player.projectedPlayoffPoints.toFixed(1)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-[#5a6b57]">ADP</div>
                  <div className="font-semibold text-[#c8d9c3]">{player.adp ? player.adp.toFixed(1) : '-'}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPlayers.length > 32 && (
        <div className="text-center text-sm text-[#5a6b57] py-4">
          Showing first 32 of {filteredPlayers.length} players. Refine your search to see more.
        </div>
      )}
    </div>
  );
}
