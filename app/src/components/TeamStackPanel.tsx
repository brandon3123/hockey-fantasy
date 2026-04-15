'use client';

import { Player, DraftPick } from '@/types/player';
import { cn } from '@/lib/utils';

interface TeamStackPanelProps {
  yourPicks: DraftPick[];
  availablePlayers: Player[];
  allPlayers: Player[];
  onDraftPlayer?: (player: Player) => void;
}

export default function TeamStackPanel({
  yourPicks,
  availablePlayers,
  allPlayers,
  onDraftPlayer
}: TeamStackPanelProps) {
  // Count players per team from your picks (using allPlayers for lookup since drafted players are removed from available)
  const teamCounts: Record<string, number> = {};
  for (const pick of yourPicks) {
    const player = allPlayers.find(p => p.name === pick.playerName);
    if (player) {
      teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
    }
  }

  const sortedTeams = Object.entries(teamCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (sortedTeams.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-2">Team Stack</h3>
        <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
          Draft players to see team stacking options
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Team Stack</h3>
      <p className="text-sm text-gray-600">
        Your top invested teams. Stacking players from deep playoff teams maximizes value.
      </p>

      {sortedTeams.map(([team, count]) => {
        const teammates = availablePlayers
          .filter(p => p.team === team)
          .sort((a, b) => b.projectedPlayoffPoints - a.projectedPlayoffPoints);

        return (
          <div key={team} className="border rounded-lg p-3 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-blue-900">
                {team} - {count} player{count !== 1 ? 's' : ''}
              </div>
              <div className="text-sm text-blue-700">
                {teammates.length} available
              </div>
            </div>

            {teammates.length > 0 ? (
              <div className="space-y-1">
                {teammates.slice(0, 5).map(player => (
                  <div
                    key={player.name}
                    className={cn(
                      "flex items-center justify-between p-2 rounded cursor-pointer hover:bg-blue-100 transition-colors",
                      "text-sm"
                    )}
                    onClick={() => onDraftPlayer?.(player)}
                  >
                    <div>
                      <span className="font-medium">{player.name}</span>
                      <span className="text-gray-600 ml-2">{player.position}</span>
                    </div>
                    <span className="font-semibold text-blue-700">
                      {player.projectedPlayoffPoints.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                No teammates available
              </div>
            )}
          </div>
        );
      })}

      <div className="text-xs text-gray-500">
        💡 Tip: Pick 2-3 teams you think will go deep and load up on their players
      </div>
    </div>
  );
}
