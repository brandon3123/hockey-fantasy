'use client';

import { useState, useMemo } from 'react';
import { Player } from '@/types/player';
import {
  isInjured,
  getHotColdStatus,
  cn,
} from '@/lib/utils';
import InjuryFlag from './InjuryFlag';
import WatchlistToggle from './WatchlistToggle';
import RecentFormIndicator from './RecentFormIndicator';

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
    return <span>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label htmlFor="position-filter" className="block text-sm font-medium mb-1">
            Position
          </label>
          <select
            id="position-filter"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All</option>
            <option value="C">Center</option>
            <option value="LW">Left Wing</option>
            <option value="RW">Right Wing</option>
            <option value="D">Defense</option>
          </select>
        </div>

        <div>
          <label htmlFor="team-filter" className="block text-sm font-medium mb-1">
            Team
          </label>
          <select
            id="team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search" className="block text-sm font-medium mb-1">
            Search
          </label>
          <input
            id="search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Player name or team..."
            className="px-3 py-2 border rounded-md w-64"
          />
        </div>

        <div className="ml-auto flex items-end">
          <span className="text-sm text-gray-600">
            Showing {filteredPlayers.length} of {players.length} players
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200" onClick={() => handleSort('rank')}>
                Rank<SortIcon field="rank" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200" onClick={() => handleSort('name')}>
                Name<SortIcon field="name" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200" onClick={() => handleSort('team')}>
                Team<SortIcon field="team" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer hover:bg-gray-200" onClick={() => handleSort('position')}>
                Pos<SortIcon field="position" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200" onClick={() => handleSort('pointsPerGame')}>
                PPG<SortIcon field="pointsPerGame" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200" onClick={() => handleSort('projectedPlayoffPoints')}>
                Proj Pts<SortIcon field="projectedPlayoffPoints" />
              </th>
              <th className="px-4 py-3 text-right">Proj Games</th>
              <th className="px-4 py-3 text-center">Form</th>
              <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-200" onClick={() => handleSort('adp')}>
                ADP<SortIcon field="adp" />
              </th>
              <th className="px-4 py-3 text-center">Watch</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map(player => {
              const hotColdStatus = getHotColdStatus(player);

              return (
                <tr
                  key={player.name}
                  className={cn(
                    "border-t hover:bg-gray-50",
                    isInjured(player) && "bg-gray-50",
                    hotColdStatus === 'hot' && "bg-green-50",
                    hotColdStatus === 'cold' && "bg-red-50"
                  )}
                >
                  <td className="px-4 py-3 font-medium">#{player.rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{player.name}</span>
                      <InjuryFlag player={player} />
                    </div>
                  </td>
                  <td className="px-4 py-3">{player.team}</td>
                  <td className="px-4 py-3">{player.position}</td>
                  <td className="px-4 py-3 text-right">{player.pointsPerGame.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {player.projectedPlayoffPoints.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {player.projectedPlayoffGames.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RecentFormIndicator player={player} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {player.adp ? player.adp.toFixed(1) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <WatchlistToggle
                      playerName={player.name}
                      isWatched={watchlist.has(player.name)}
                      onToggle={onToggleWatchlist}
                    />
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
