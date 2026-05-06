'use client';

import { DraftState, DraftPick, Player } from '@/types/player';

interface PositionTrackerProps {
  draftState: DraftState;
  allPlayers: Player[];
}

export default function PositionTracker({ draftState, allPlayers }: PositionTrackerProps) {
  const yourPicks = draftState.picks.filter(p => p.participantId === draftState.yourParticipantId);

  // Count positions
  const positionCounts: Record<string, number> = {
    C: 0,
    LW: 0,
    RW: 0,
    D: 0,
    G: 0,
  };

  yourPicks.forEach(pick => {
    const player = allPlayers.find(p => p.name === pick.playerName);
    if (player && player.position) {
      positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
    }
  });

  const positions = ['C', 'LW', 'RW', 'D', 'G'] as const;
  const totalPicks = yourPicks.length;
  const remainingPicks = draftState.playersPerTeam - totalPicks;

  // Calculate "ideal" distribution (flexible based on remaining picks)
  const idealDistribution = {
    C: Math.max(2, Math.round(remainingPicks * 0.25)),
    LW: Math.max(2, Math.round(remainingPicks * 0.20)),
    RW: Math.max(2, Math.round(remainingPicks * 0.20)),
    D: Math.max(2, Math.round(remainingPicks * 0.25)),
    G: Math.max(1, Math.round(remainingPicks * 0.10)),
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold mb-2 text-[#c8d9c3]">
          Position Tracker
        </h3>
        <div className="w-full h-px bg-[#141e12]"></div>
        <p className="text-xs text-[#5a6b57] mt-4">
          Your team composition ({totalPicks}/{draftState.playersPerTeam} picks)
        </p>
      </div>

      {/* Position breakdown */}
      <div className="space-y-3">
        {positions.map(pos => {
          const count = positionCounts[pos];
          const ideal = idealDistribution[pos];
          const isFilled = count >= ideal;
          const isLow = count < ideal && remainingPicks > 0;
          const progressPercent = Math.min(100, (count / ideal) * 100);

          return (
            <div key={pos} className="bg-[#050a05] border border-[#141e12] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm ${
                    isFilled
                      ? 'bg-[#4a7c59] text-[#c8d9c3]'
                      : isLow
                      ? 'bg-[#141e12] text-[#5a6b57]'
                      : 'bg-[#0a0f0a] text-[#5a6b57]'
                  }`}>
                    {pos}
                  </div>
                  <div className="text-sm font-semibold text-[#c8d9c3]">
                    {count} / {ideal}+
                  </div>
                </div>
                {isLow && remainingPicks > 0 && (
                  <div className="text-xs text-[#5a6b57]">
                    Need {ideal - count} more
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-[#141e12] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isFilled
                      ? 'bg-[#4a7c59]'
                      : isLow
                      ? 'bg-[#6b9b7a]'
                      : 'bg-[#2d3c28]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-[#0a0f0a] p-4 rounded-lg border border-[#141e12]">
        <div className="text-center text-sm text-[#5a6b57]">
          {remainingPicks > 0 ? (
            <div>
              <div className="font-semibold mb-1">{remainingPicks} picks remaining</div>
              <div className="text-xs">Focus on positions marked &quot;Need more&quot;</div>
            </div>
          ) : (
            <div className="font-semibold text-[#6b9b7a]">Roster complete!</div>
          )}
        </div>
      </div>

      {/* Team breakdown */}
      {yourPicks.length > 0 && (
        <div className="border-t border-[#141e12] pt-4">
          <h4 className="text-sm font-semibold text-[#c8d9c3] mb-3">Your Picks</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {yourPicks.map(pick => {
              const player = allPlayers.find(p => p.name === pick.playerName);
              if (!player) return null;

              return (
                <div
                  key={pick.playerName}
                  className="flex items-center gap-3 p-2 bg-[#050a05] border border-[#141e12] rounded"
                >
                  <div className="text-xs text-[#5a6b57] font-semibold w-10">
                    R{pick.round}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#c8d9c3]">{player.name}</div>
                    <div className="text-xs text-[#5a6b57]">
                      {player.team} • {player.position}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#6b9b7a]">
                    {player.displayPoints.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
