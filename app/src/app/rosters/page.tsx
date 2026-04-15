'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types/player';
import Link from 'next/link';

interface RosterPlayer {
  name: string;
  team: string;
  position: string;
  projectedPoints: number;
  injury: string;
}

interface ManagerRoster {
  name: string;
  players: RosterPlayer[];
  totalProjectedPoints: number;
  injuryCount: number;
}

export default function RostersPage() {
  const [rosters, setRosters] = useState<ManagerRoster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('draftState');
      if (!savedDraft) {
        setLoading(false);
        return;
      }

      const draftState = JSON.parse(savedDraft);
      const managersCount = draftState.managers;

      // Load full player data to get projections
      fetch('/players.json')
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load players: ${res.status}`);
          return res.json();
        })
        .then((allPlayers: Player[]) => {
          const playerMap = new Map<string, Player>(
            allPlayers.map((p: Player) => [p.name, p])
          );

          const managerRosters: ManagerRoster[] = Array.from(
            { length: managersCount },
            (_, i) => {
              const picks = draftState.picks.filter((p: { managerIndex: number }) => p.managerIndex === i);

              const rosterPlayers: RosterPlayer[] = picks.map((p: { playerName: string }) => {
                const playerData = playerMap.get(p.playerName);
                return {
                  name: p.playerName,
                  team: playerData?.team ?? '',
                  position: playerData?.position ?? '',
                  projectedPoints: playerData?.projectedPlayoffPoints ?? 0,
                  injury: playerData?.injury?.status ?? 'healthy',
                };
              });

              const totalProjectedPoints = rosterPlayers.reduce(
                (sum, p) => sum + p.projectedPoints,
                0
              );

              const injuryCount = rosterPlayers.filter(
                p => p.injury !== 'healthy'
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
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    } catch (e) {
      console.error('Failed to load draft state:', e);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading draft results...</div>
      </div>
    );
  }

  if (rosters.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Draft Found</h1>
          <p className="text-gray-600 mb-6">
            Complete a draft first to see roster analysis.
          </p>
          <Link
            href="/draft"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold"
          >
            Go to Draft Board
          </Link>
        </div>
      </div>
    );
  }

  const winner = rosters.reduce((max, roster) =>
    roster.totalProjectedPoints > max.totalProjectedPoints ? roster : max
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Draft Results</h1>
          <Link href="/" className="text-blue-600">
            Back to Rankings
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Winner announcement */}
        <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-xl font-bold text-yellow-900">
            Projected Winner: {winner.name}
          </h2>
          <p className="text-yellow-800">
            {winner.totalProjectedPoints.toFixed(1)} projected points
          </p>
        </div>

        {/* Rosters side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rosters.map((roster) => (
            <div key={roster.name} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className={`px-4 py-3 border-b ${roster.name === 'You' ? 'bg-blue-50' : 'bg-gray-100'}`}>
                <h3 className="font-bold text-lg">{roster.name}</h3>
                <p className="text-sm text-gray-600">
                  {roster.totalProjectedPoints.toFixed(1)} pts
                  {roster.injuryCount > 0 && ` • ${roster.injuryCount} injured`}
                </p>
              </div>

              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-2">Player</th>
                      <th className="pb-2 text-right">Proj Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.players.map((player) => (
                      <tr key={player.name} className="border-t">
                        <td className="py-2">
                          {player.name}
                          {player.injury !== 'healthy' && (
                            <span className="ml-2 text-yellow-600">!</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {player.projectedPoints.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
