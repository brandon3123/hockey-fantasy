'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types/player';
import { removeSpecificPick } from '@/lib/draft-logic';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';
import InjuryFlag from '@/components/InjuryFlag';

interface RosterPlayer {
  name: string;
  team: string;
  position: string;
  projectedPoints: number;
  injury: {
    status: "healthy" | "day-to-day" | "week-to-week" | "out indefinitely" | "out for playoffs";
    expectedReturn: string | null;
    description: string | null;
  };
}

interface ManagerRoster {
  name: string;
  players: RosterPlayer[];
  totalProjectedPoints: number;
  injuryCount: number;
}

export default function RostersPage() {
  const [rosters, setRosters] = useState<ManagerRoster[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingManager, setEditingManager] = useState<number | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    try {
      const savedDraft = localStorage.getItem('draftState');
      if (!savedDraft) {
        setLoading(false);
        return;
      }

      const draftState = JSON.parse(savedDraft);

      // Load both players and draft state
      Promise.all([
        fetch('/players.json', { signal: controller.signal }),
      ])
        .then(([playersRes]) => {
          if (!playersRes.ok) throw new Error(`Failed to load players: ${playersRes.status}`);
          return playersRes.json();
        })
        .then((allPlayers: Player[]) => {
          setAllPlayers(allPlayers);

          const playerMap = new Map(allPlayers.map((p: Player) => [p.name, p]));

          // Get picked player names
          const pickedNames = new Set(draftState.picks.map((p: { playerName: string }) => p.playerName));

          // Available players are those not picked
          const available = allPlayers.filter(p => !pickedNames.has(p.name));
          setAvailablePlayers(available);

          const managerRosters: ManagerRoster[] = Array.from(
            { length: draftState.managers },
            (_, i) => {
              const picks = draftState.picks.filter((p: { managerIndex: number }) => p.managerIndex === i);
              const rosterPlayers: RosterPlayer[] = picks.map((p: { playerName: string }) => {
                const playerData = playerMap.get(p.playerName);
                return {
                  name: p.playerName,
                  team: playerData?.team ?? '',
                  position: playerData?.position ?? '',
                  projectedPoints: playerData?.projectedPlayoffPoints ?? 0,
                  injury: playerData?.injury ?? { status: 'healthy', expectedReturn: null, description: null },
                };
              });

              const totalProjectedPoints = rosterPlayers.reduce(
                (sum, p) => sum + p.projectedPoints,
                0
              );

              const injuryCount = rosterPlayers.filter(
                p => p.injury.status !== 'healthy'
              ).length;

              return {
                name: i === draftState.yourPosition - 1 ? 'You' : `Manager ${i + 1}`,
                players: rosterPlayers,
                totalProjectedPoints,
                injuryCount,
              };
            }
          );

          setRosters(managerRosters);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error(err);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (e) {
      console.error('Failed to load draft state:', e);
      setLoading(false);
    }

    return () => controller.abort();
  }, []);

  const filteredAvailablePlayers = searchTerm
    ? availablePlayers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : availablePlayers.slice(0, 20);

  const handleRemovePlayer = (managerIndex: number, playerName: string) => {
    const savedDraft = localStorage.getItem('draftState');
    if (!savedDraft) return;

    const draftState = JSON.parse(savedDraft);
    const pickIndex = draftState.picks.findIndex(
      (p: { playerName: string; managerIndex: number }) =>
        p.playerName === playerName && p.managerIndex === managerIndex
    );

    if (pickIndex !== -1) {
      const newState = removeSpecificPick(draftState, pickIndex, allPlayers);

      // Recalculate playersPerTeam after removal
      const maxPicksPerTeam = Math.max(
        ...newState.picks.map(p =>
          newState.picks.filter(pick => pick.managerIndex === p.managerIndex).length
        ),
        1 // minimum of 1 if no picks exist
      );

      newState.playersPerTeam = maxPicksPerTeam;

      localStorage.setItem('draftState', JSON.stringify(newState));

      // Update state directly instead of reloading
      const playerMap = new Map(allPlayers.map((p: Player) => [p.name, p]));
      const pickedNames = new Set(newState.picks.map((p: { playerName: string }) => p.playerName));
      const available = allPlayers.filter(p => !pickedNames.has(p.name));

      // Recalculate rosters
      const managerRosters = Array.from(
        { length: newState.managers },
        (_, i) => {
          const picks = newState.picks.filter((p: { managerIndex: number }) => p.managerIndex === i);
          const rosterPlayers: RosterPlayer[] = picks.map((p: { playerName: string }) => {
            const playerData = playerMap.get(p.playerName);
            return {
              name: p.playerName,
              team: playerData?.team ?? '',
              position: playerData?.position ?? '',
              projectedPoints: playerData?.projectedPlayoffPoints ?? 0,
              injury: playerData?.injury ?? { status: 'healthy', expectedReturn: null, description: null },
            };
          });

          const totalProjectedPoints = rosterPlayers.reduce(
            (sum, p) => sum + p.projectedPoints,
            0
          );

          const injuryCount = rosterPlayers.filter(
            p => p.injury.status !== 'healthy'
          ).length;

          return {
            name: i === newState.yourPosition - 1 ? 'You' : `Manager ${i + 1}`,
            players: rosterPlayers,
            totalProjectedPoints,
            injuryCount,
          };
        }
      );

      setRosters(managerRosters);
      setAvailablePlayers(available);
    }
  };

  const handleAddPlayer = (managerIndex: number, player: Player) => {
    const savedDraft = localStorage.getItem('draftState');
    if (!savedDraft) return;

    const draftState = JSON.parse(savedDraft);

    // Check if player is already drafted by any team
    const alreadyDrafted = draftState.picks.some(
      pick => pick.playerName === player.name
    );

    if (alreadyDrafted) {
      alert(`${player.name} is already on a team!`);
      return;
    }

    // Check if this manager already has this player
    const managerAlreadyHasPlayer = draftState.picks.some(
      pick => pick.playerName === player.name && pick.managerIndex === managerIndex
    );

    if (managerAlreadyHasPlayer) {
      alert(`${rosters[managerIndex].name} already has ${player.name}!`);
      return;
    }

    const managerPicks = draftState.picks.filter(p => p.managerIndex === managerIndex);
    const round = managerPicks.length + 1;

    // Add the new player
    const newPick = {
      playerId: player.name,
      playerName: player.name,
      round: round,
      managerIndex: managerIndex,
    };

    // Calculate the new playersPerTeam based on the team with the most players
    const updatedPicks = [...draftState.picks, newPick];
    const maxPicksPerTeam = Math.max(
      ...updatedPicks.map(p =>
        updatedPicks.filter(pick => pick.managerIndex === p.managerIndex).length
      )
    );

    const updatedState = {
      ...draftState,
      picks: updatedPicks,
      availablePlayers: draftState.availablePlayers.filter(p => p.name !== player.name),
      playersPerTeam: maxPicksPerTeam,
    };

    localStorage.setItem('draftState', JSON.stringify(updatedState));

    // Update state directly instead of reloading
    const playerMap = new Map(allPlayers.map((p: Player) => [p.name, p]));
    const pickedNames = new Set(updatedState.picks.map((p: { playerName: string }) => p.playerName));
    const available = allPlayers.filter(p => !pickedNames.has(p.name));

    // Recalculate rosters
    const managerRosters = Array.from(
      { length: updatedState.managers },
      (_, i) => {
        const picks = updatedState.picks.filter((p: { managerIndex: number }) => p.managerIndex === i);
        const rosterPlayers: RosterPlayer[] = picks.map((p: { playerName: string }) => {
          const playerData = playerMap.get(p.playerName);
          return {
            name: p.playerName,
            team: playerData?.team ?? '',
            position: playerData?.position ?? '',
            projectedPoints: playerData?.projectedPlayoffPoints ?? 0,
            injury: playerData?.injury ?? { status: 'healthy', expectedReturn: null, description: null },
          };
        });

        const totalProjectedPoints = rosterPlayers.reduce(
          (sum, p) => sum + p.projectedPoints,
          0
        );

        const injuryCount = rosterPlayers.filter(
          p => p.injury.status !== 'healthy'
        ).length;

        return {
          name: i === updatedState.yourPosition - 1 ? 'You' : `Manager ${i + 1}`,
          players: rosterPlayers,
          totalProjectedPoints,
          injuryCount,
        };
      }
    );

    setRosters(managerRosters);
    setAvailablePlayers(available);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#c8d9c3] mb-4">Loading rosters...</div>
          <div className="w-64 h-2 bg-[#141e12] rounded-full overflow-hidden">
            <div className="h-full bg-[#4a7c59] animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (rosters.length === 0) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12]">
          <h1 className="text-3xl font-bold mb-6 text-[#c8d9c3]">No Draft Found</h1>
          <p className="text-[#5a6b57] mb-8">Complete a draft first to see roster analysis</p>
          <Link
            href="/draft"
            className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Go to Draft Board
          </Link>
        </div>
      </div>
    );
  }

  const winner = rosters.length > 0
    ? rosters.reduce((max, roster) =>
        roster.totalProjectedPoints > max.totalProjectedPoints ? roster : max
      )
    : null;

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-[#c8d9c3]">Team Rosters</h1>
          <div className="w-full h-px bg-[#141e12]"></div>
          <p className="text-sm text-[#5a6b57] mt-4">
            Click "Add" on any team roster to add/remove players
          </p>
        </div>

        {/* Winner announcement */}
        {winner && (
          <div className="bg-[#0a0f0a] p-6 mb-8 rounded-lg border-2 border-[#4a7c59]">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-[#6b9b7a] mb-3">Projected Winner</h2>
              <div className="text-3xl font-bold text-[#c8d9c3] mb-2">{winner.name}</div>
              <div className="text-xl text-[#6b9b7a] font-semibold">
                {winner.totalProjectedPoints.toFixed(1)} Projected Points
              </div>
            </div>
          </div>
        )}

        {/* Editable Rosters */}
        {editingManager !== null && (
          <div className="bg-[#0a0f0a] p-6 mb-8 rounded-lg border-2 border-[#4a7c59]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#c8d9c3]">
                Editing: {rosters[editingManager].name}
              </h3>
              <button
                onClick={() => setEditingManager(null)}
                className="px-4 py-2 bg-[#141e12] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#2d3c28] transition-colors"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Current Roster */}
              <div>
                <h4 className="text-sm font-semibold text-[#6b9b7a] mb-3">Current Roster</h4>
                <div className="space-y-2 max-h-[500px] overflow-y-auto border border-[#141e12] rounded-lg p-3 bg-[#050a05]">
                  {rosters[editingManager].players.map((player) => (
                    <div
                      key={player.name}
                      className="flex items-center gap-3 p-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg"
                    >
                      <TeamLogo team={player.team} className="w-8 h-8" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-[#c8d9c3]">
                          {player.name}
                        </div>
                        <div className="text-xs text-[#5a6b57]">
                          {player.team} • {player.position}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#6b9b7a]">
                          {player.projectedPoints.toFixed(1)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemovePlayer(editingManager, player.name)}
                        className="px-3 py-1 text-xs bg-[#141e12] text-[#5a6b57] rounded hover:bg-[#2d3c28] hover:text-[#c8d9c3] transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {rosters[editingManager].players.length === 0 && (
                    <div className="text-center text-[#5a6b57] py-8">
                      No players on roster
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Available Players */}
              <div>
                <h4 className="text-sm font-semibold text-[#6b9b7a] mb-3">Available Players</h4>
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search available players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-[#141e12] rounded-lg bg-[#050a05] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
                  />
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto border border-[#141e12] rounded-lg p-3 bg-[#050a05]">
                  {filteredAvailablePlayers.map(player => (
                    <div
                      key={player.name}
                      onClick={() => handleAddPlayer(editingManager, player)}
                      className="flex items-center gap-3 p-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg hover:border-[#4a7c59] hover:bg-[#050a05] cursor-pointer transition-all"
                    >
                      <div className="text-xs text-[#5a6b57] font-semibold w-10">
                        #{player.rank}
                      </div>
                      <TeamLogo team={player.team} className="w-8 h-8" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-[#c8d9c3]">
                          {player.name}
                        </div>
                        <div className="text-xs text-[#5a6b57]">
                          {player.team} • {player.position}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#6b9b7a]">
                          {player.projectedPlayoffPoints.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredAvailablePlayers.length === 0 && (
                    <div className="text-center text-[#5a6b57] py-8">
                      No available players
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rosters grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rosters.map((roster, managerIndex) => (
            <div
              key={managerIndex}
              className={`bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden cursor-pointer transition-all ${
                editingManager === managerIndex ? 'ring-2 ring-[#4a7c59]' : ''
              }`}
              onClick={() => setEditingManager(managerIndex)}
            >
              {/* Header */}
              <div className={`p-6 border-b border-[#141e12] ${
                roster.name === 'You'
                  ? 'bg-[#4a7c59]'
                  : 'bg-[#141e12]'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-[#c8d9c3]">
                    {roster.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingManager(managerIndex);
                    }}
                    className="px-3 py-1 text-sm bg-[#050a05] text-[#c8d9c3] rounded hover:bg-[#0a0f0a] transition-all"
                  >
                    Edit
                  </button>
                </div>
                  <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-[#c8d9c3]">
                      {roster.totalProjectedPoints.toFixed(1)}
                    </span>
                    <span className="text-xs text-[#c8d9c3]">
                      PROJECTED PTS
                    </span>
                  </div>
                </div>
              </div>

              {/* Players Table */}
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#141e12]">
                      <th className="pb-2 text-left text-xs font-semibold text-[#5a6b57]">
                        PLAYER
                      </th>
                      <th className="pb-2 text-right text-xs font-semibold text-[#5a6b57]">
                        PROJ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.players.map((player) => (
                      <tr key={player.name} className="border-b border-[#141e12] group">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <TeamLogo team={player.team} className="w-6 h-6" />
                            <div>
                              <div className="text-sm font-medium text-[#c8d9c3] flex items-center gap-2">
                                {player.name}
                                <InjuryFlag player={{
                                  name: player.name,
                                  team: player.team,
                                  position: player.position as any,
                                  regularSeasonGoals: 0,
                                  regularSeasonAssists: 0,
                                  gamesPlayed: 0,
                                  pointsPerGame: 0,
                                  teamAdvancementOdds: { round1: 0, round2: 0, round3: 0, round4: 0 },
                                  projectedPlayoffGames: 0,
                                  projectedPlayoffPoints: player.projectedPoints,
                                  rank: 0,
                                  injury: player.injury
                                }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-sm font-semibold text-[#6b9b7a]">
                            {player.projectedPoints.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}