'use client';

import { Player } from '@/types/player';
import { cn, getAdpValue, isAdpSteal, isAdpReach, isInjured } from '@/lib/utils';
import InjuryFlag from './InjuryFlag';

interface BestAvailableProps {
  availablePlayers: Player[];
  currentPick: number;
  onDraftPlayer?: (player: Player) => void;
}

export default function BestAvailable({
  availablePlayers,
  currentPick,
  onDraftPlayer
}: BestAvailableProps) {
  const sorted = [...availablePlayers].sort(
    (a, b) => b.projectedPlayoffPoints - a.projectedPlayoffPoints
  );

  const top3 = sorted.slice(0, 3);
  const bestHealthy = sorted.find(p => !isInjured(p));

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Best Available</h3>

      <div className="space-y-2">
        {top3.map((player, index) => {
          const steal = isAdpSteal(player, currentPick);
          const reach = isAdpReach(player, currentPick);
          const adpDiff = getAdpValue(player, currentPick);

          return (
            <div
              key={player.name}
              className={cn(
                "p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors",
                index === 0 && "border-blue-500 bg-blue-50"
              )}
              onClick={() => onDraftPlayer?.(player)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-400">
                      #{player.rank}
                    </span>
                    <div>
                      <div className="font-semibold text-lg flex items-center gap-1">
                        {player.name}
                        <InjuryFlag player={player} />
                      </div>
                      <div className="text-sm text-gray-600">
                        {player.team} - {player.position}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {player.projectedPlayoffPoints.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {player.pointsPerGame.toFixed(2)} PPG
                  </div>

                  {player.adp && (
                    <div className={cn(
                      "text-xs mt-1",
                      steal && "text-green-600",
                      reach && "text-red-600",
                      !steal && !reach && "text-gray-500"
                    )}>
                      {adpDiff > 0 && `Value: +${adpDiff.toFixed(1)}`}
                      {adpDiff < 0 && `Reach: ${adpDiff.toFixed(1)}`}
                      {adpDiff === 0 && `ADP: ${player.adp.toFixed(1)}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {top3.length > 0 && isInjured(top3[0]) && bestHealthy && bestHealthy.name !== top3[0].name && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Best Healthy Alternative
          </h4>
          <div
            className="p-3 border border-green-300 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100"
            onClick={() => onDraftPlayer?.(bestHealthy)}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">{bestHealthy.name}</span>
                <span className="text-sm text-gray-600 ml-2">
                  {bestHealthy.team} - {bestHealthy.position}
                </span>
              </div>
              <span className="font-bold text-green-700">
                {bestHealthy.projectedPlayoffPoints.toFixed(1)} pts
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
