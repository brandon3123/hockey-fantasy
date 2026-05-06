'use client';

import { DraftState, DraftPick, Player } from '@/types/player';

interface TeamCompositionVisualizerProps {
  draftState: DraftState;
  allPlayers: Player[];
}

export default function TeamCompositionVisualizer({
  draftState,
  allPlayers
}: TeamCompositionVisualizerProps) {
  const yourPicks = draftState.picks.filter(p => p.participantId === draftState.yourParticipantId);

  if (yourPicks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold mb-2 text-[#c8d9c3]">
            Team Visualizer
          </h3>
          <div className="w-full h-px bg-[#141e12]"></div>
        </div>
        <div className="bg-[#050a05] p-6 text-center rounded-lg border border-[#141e12]">
          <div className="text-sm text-[#5a6b57]">Draft players to see team breakdown</div>
        </div>
      </div>
    );
  }

  // Group by position
  const byPosition: Record<string, typeof yourPicks> = {
    C: [],
    LW: [],
    RW: [],
    D: [],
    G: [],
  };

  // Group by team
  const byTeam: Record<string, typeof yourPicks> = {};

  // Calculate totals
  let totalProjectedPoints = 0;
  let totalProjectedGames = 0;

  yourPicks.forEach(pick => {
    const player = allPlayers.find(p => p.name === pick.playerName);
    if (!player) return;

    if (player.position) {
      byPosition[player.position].push(pick);
    }

    if (!byTeam[player.team]) {
      byTeam[player.team] = [];
    }
    byTeam[player.team].push(pick);

    totalProjectedPoints += player.displayPoints;
    totalProjectedGames += player.displayGames;
  });

  // Sort teams by player count
  const sortedTeams = Object.entries(byTeam)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 5);

  const avgPointsPerPlayer = yourPicks.length > 0
    ? totalProjectedPoints / yourPicks.length
    : 0;

  const avgGamesPerPlayer = yourPicks.length > 0
    ? totalProjectedGames / yourPicks.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold mb-2 text-[#c8d9c3]">
          Team Visualizer
        </h3>
        <div className="w-full h-px bg-[#141e12]"></div>
        <p className="text-xs text-[#5a6b57] mt-4">
          Visual breakdown of your roster
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[#6b9b7a]">
            {totalProjectedPoints.toFixed(1)}
          </div>
          <div className="text-xs text-[#5a6b57] mt-1">
            Total Proj Pts
          </div>
        </div>
        <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[#6b9b7a]">
            {totalProjectedGames.toFixed(1)}
          </div>
          <div className="text-xs text-[#5a6b57] mt-1">
            Total Proj GP
          </div>
        </div>
        <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[#c8d9c3]">
            {avgPointsPerPlayer.toFixed(1)}
          </div>
          <div className="text-xs text-[#5a6b57] mt-1">
            Avg Pts/Player
          </div>
        </div>
        <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-[#c8d9c3]">
            {avgGamesPerPlayer.toFixed(1)}
          </div>
          <div className="text-xs text-[#5a6b57] mt-1">
            Avg GP/Player
          </div>
        </div>
      </div>

      {/* Position Breakdown */}
      <div>
        <h4 className="text-sm font-semibold text-[#c8d9c3] mb-3">By Position</h4>
        <div className="space-y-2">
          {(['C', 'LW', 'RW', 'D', 'G'] as const).map(pos => {
            const picks = byPosition[pos];
            const count = picks.length;
            const maxCount = Math.max(...Object.values(byPosition).map(p => p.length));
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={pos} className="flex items-center gap-3">
                <div className="w-8 text-sm font-bold text-[#c8d9c3]">
                  {pos}
                </div>
                <div className="flex-1 h-6 bg-[#141e12] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#4a7c59] flex items-center justify-end pr-2"
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-xs font-semibold text-[#c8d9c3]">
                      {count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Breakdown */}
      {sortedTeams.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[#c8d9c3] mb-3">By Team</h4>
          <div className="space-y-2">
            {sortedTeams.map(([team, picks]) => {
              const count = picks.length;
              const maxCount = sortedTeams[0][1].length;
              const barWidth = (count / maxCount) * 100;

              // Calculate team totals
              const teamPoints = picks.reduce((sum, pick) => {
                const player = allPlayers.find(p => p.name === pick.playerName);
                return sum + (player?.displayPoints || 0);
              }, 0);

              return (
                <div key={team} className="flex items-center gap-3">
                  <div className="w-12 text-xs font-semibold text-[#c8d9c3]">
                    {team}
                  </div>
                  <div className="flex-1 h-6 bg-[#141e12] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#6b9b7a] flex items-center justify-end pr-2"
                      style={{ width: `${barWidth}%` }}
                    >
                      <span className="text-xs font-semibold text-[#c8d9c3]">
                        {count}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <div className="text-xs text-[#5a6b57]">
                      {teamPoints.toFixed(1)} pts
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk Assessment */}
      <div className="bg-[#0a0f0a] p-4 rounded-lg border border-[#141e12]">
        <h4 className="text-sm font-semibold text-[#c8d9c3] mb-3">Team Health</h4>
        <div className="space-y-2 text-xs">
          {/* Team stacking risk */}
          {sortedTeams.length > 0 && sortedTeams[0][1].length >= 4 && (
            <div className="flex items-start gap-2">
              <div className="text-[#5a6b57]">⚠️</div>
              <div className="text-[#5a6b57]">
                Heavy on {sortedTeams[0][0]} ({sortedTeams[0][1].length} players). Early exit = low points.
              </div>
            </div>
          )}

          {/* Position balance */}
          {Object.values(byPosition).filter(p => p.length === 0).length > 0 && (
            <div className="flex items-start gap-2">
              <div className="text-[#5a6b57]">⚠️</div>
              <div className="text-[#5a6b57]">
                Missing {Object.values(byPosition).filter(p => p.length === 0).map((_, i) => {
                  const pos = ['C', 'LW', 'RW', 'D', 'G'][Object.values(byPosition).findIndex(p => p.length === 0)];
                  return pos;
                }).join(', ')} positions
              </div>
            </div>
          )}

          {/* Balanced team */}
          {Object.values(byPosition).every(p => p.length > 0) &&
           sortedTeams[0][1].length < 4 && (
            <div className="flex items-start gap-2">
              <div className="text-[#4a7c59]">✓</div>
              <div className="text-[#4a7c59]">
                Well-balanced roster with good team distribution
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
