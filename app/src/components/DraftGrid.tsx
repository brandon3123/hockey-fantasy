'use client';

import { DraftState, DraftPick } from '@/types/player';
import { cn } from '@/lib/utils';

interface DraftGridProps {
  draftState: DraftState;
  managerNames: string[];
}

export default function DraftGrid({ draftState, managerNames }: DraftGridProps) {
  const { managers, yourPosition, currentRound, currentPick, picks } = draftState;

  const grid: (DraftPick | null)[][] = [];

  for (let m = 0; m < managers; m++) {
    const row: (DraftPick | null)[] = [];
    for (let r = 1; r <= draftState.playersPerTeam; r++) {
      const pick = picks.find(
        p => p.managerIndex === m && p.round === r
      );
      row.push(pick || null);
    }
    grid.push(row);
  }

  const getCurrentManagerIndex = () => {
    const isReverseRound = currentRound % 2 === 0;
    const order = Array.from({ length: managers }, (_, i) =>
      isReverseRound ? managers - i : i + 1
    );
    return order[currentPick - 1] - 1; // 0-indexed
  };

  const currentManager = getCurrentManagerIndex();
  const isYourTurn = currentManager === yourPosition - 1;

  return (
    <div className="space-y-4">
      <div className={cn(
        "text-center p-4 rounded-lg font-semibold",
        isYourTurn ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-700"
      )}>
        {isYourTurn ? "🎯 Your Turn!" : `${managerNames[currentManager] || `Manager ${currentManager + 1}`}'s Turn`}
        <span className="ml-4 text-sm font-normal">
          Round {currentRound}, Pick {currentPick}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left border">Manager</th>
              {Array.from({ length: draftState.playersPerTeam }, (_, i) => (
                <th key={i} className="px-4 py-2 text-center border min-w-[100px]">
                  R{i + 1}
                </th>
              ))}
              <th className="px-4 py-2 text-center border">Proj Pts</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, managerIndex) => {
              const isYourRow = managerIndex === yourPosition - 1;
              const isCurrentRow = managerIndex === currentManager;
              const managerPicks = picks.filter(p => p.managerIndex === managerIndex);
              const projectedPts = 0; // Simplified - no player lookup here

              return (
                <tr
                  key={managerIndex}
                  className={cn(
                    isCurrentRow && "bg-yellow-50",
                    isYourRow && "bg-blue-50 font-semibold"
                  )}
                >
                  <td className={cn(
                    "px-4 py-2 border",
                    isCurrentRow && "bg-yellow-200",
                    isYourRow && "bg-blue-200"
                  )}>
                    {managerNames[managerIndex] || `Manager ${managerIndex + 1}`}
                    {isCurrentRow && " ←"}
                  </td>
                  {row.map((pick, roundIndex) => {
                    const isCurrentPick =
                      managerIndex === currentManager &&
                      roundIndex + 1 === currentRound;

                    return (
                      <td
                        key={roundIndex}
                        className={cn(
                          "px-4 py-2 border text-center",
                          isCurrentPick && "ring-2 ring-yellow-400 ring-inset"
                        )}
                      >
                        {pick ? (
                          <div className="text-sm">
                            <div className="font-medium">{pick.playerName}</div>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 border text-center">
                    {projectedPts > 0 ? projectedPts.toFixed(1) : '-'}
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
