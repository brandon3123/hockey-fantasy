'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types/player';
import { cn, getAdpValue, isAdpSteal, isAdpReach, isInjured } from '@/lib/utils';
import InjuryFlag from './InjuryFlag';
import TeamLogo from './TeamLogo';
import WatchlistToggle from './WatchlistToggle';
import { loadLines, getPlayerLine } from '@/lib/moneypuck-parser';

interface BestAvailableProps {
  availablePlayers: Player[];
  currentPick: number;
  onDraftPlayer?: (player: Player) => void;
  watchlist?: Set<string>;
  onToggleWatchlist?: (playerName: string) => void;
  draftComplete?: boolean;
}

export default function BestAvailable({
  availablePlayers,
  currentPick,
  onDraftPlayer,
  watchlist = new Set(),
  onToggleWatchlist,
  draftComplete = false
}: BestAvailableProps) {
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const linesData = await loadLines();
      if (linesData) setLines(linesData);
    };
    loadData();
  }, []);

  const sorted = [...availablePlayers].sort(
    (a, b) => b.projectedPlayoffPoints - a.projectedPlayoffPoints
  );

  const top3 = sorted.slice(0, 3);
  const bestHealthy = sorted.find(p => !isInjured(p));

  // Helper to get line info
  const getPlayerLineInfo = (playerName: string) => {
    if (!lines.length) return null;
    return getPlayerLine(playerName, lines);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold mb-2 text-[#c8d9c3]">
          Best Available
        </h3>
        <div className="w-full h-px bg-[#141e12]"></div>
      </div>

      {/* Top 3 Players */}
      <div className="space-y-4">
        {top3.map((player, index) => {
          const steal = isAdpSteal(player, currentPick);
          const reach = isAdpReach(player, currentPick);
          const adpDiff = getAdpValue(player, currentPick);

          return (
            <div
              key={player.name}
              onClick={(e) => {
                if (draftComplete) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                onDraftPlayer?.(player);
              }}
              className={`p-4 rounded-lg transition-all border ${
                index === 0
                  ? 'bg-[#0a0f0a] border-[#4a7c59]'
                  : 'bg-[#050a05] border border-[#141e12] hover:border-[#4a7c59]'
              } ${draftComplete ? 'opacity-50' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-4">
                {/* Rank Badge */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                  index === 0 ? 'bg-[#4a7c59] text-[#c8d9c3]' : 'bg-[#141e12] text-[#5a6b57]'
                }`}>
                  #{index + 1}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {onToggleWatchlist && (
                      <WatchlistToggle
                        playerName={player.name}
                        isWatched={watchlist.has(player.name)}
                        onToggle={onToggleWatchlist}
                      />
                    )}
                    <TeamLogo team={player.team} className="w-6 h-6 shrink-0" />
                    <span className="text-sm font-semibold text-[#c8d9c3] truncate">
                      {player.name}
                    </span>
                    <InjuryFlag player={player} />
                  </div>
                  <div className="text-xs text-[#5a6b57]">
                    {player.team} • {player.position}
                  </div>
                  {lines.length > 0 && (() => {
                    const lineInfo = getPlayerLineInfo(player.name);
                    if (!lineInfo) return null;
                    return (
                      <div className="text-xs text-[#5a6b57] mt-1">
                        Line: {lineInfo.name}
                      </div>
                    );
                  })()}
                </div>

                {/* Stats */}
                <div className="text-right shrink-0 min-w-fit">
                  <div className="text-2xl font-bold text-[#c8d9c3]">
                    {player.projectedPlayoffPoints.toFixed(1)}
                    <span className="text-xs font-normal text-[#5a6b57] ml-1">proj</span>
                  </div>
                  <div className="text-xs text-[#5a6b57]">
                    {player.projectedPlayoffGames.toFixed(1)} gp • {player.pointsPerGame.toFixed(2)} ppg
                  </div>

                  {/* Badges */}
                  <div className="flex flex-col gap-1 mt-1 items-end">
                    {/* Team Advancement Odds */}
                    {(() => {
                      const round2Chance = player.teamAdvancementOdds?.round2 ? player.teamAdvancementOdds.round2 * 100 : null;
                      if (!round2Chance) return null;
                      return (
                        <div className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                          round2Chance >= 60 ? 'bg-[#1a3d1a] text-[#6b9b7a] border border-[#4a7c59]' :
                          round2Chance >= 40 ? 'bg-[#3d3a1a] text-[#9b8f6b] border border-[#7c744a]' :
                          'bg-[#3d1a1a] text-[#9b6b6b] border border-[#7c4a4a]'
                        }`}>
                          {round2Chance.toFixed(0)}% R2
                        </div>
                      );
                    })()}

                    {/* ADP Indicator */}
                    {player.adp && (
                      <div className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
                        steal ? 'bg-[#4a7c59] text-[#c8d9c3]' :
                        reach ? 'bg-[#0a0f0a] text-[#5a6b57] border border-[#141e12]' :
                        'bg-[#0a0f0a] text-[#5a6b57] border border-[#141e12]'
                      }`}>
                        {adpDiff > 0 && `+${adpDiff.toFixed(1)} value`}
                        {adpDiff < 0 && `${Math.abs(adpDiff).toFixed(1)} early`}
                        {adpDiff === 0 && `ADP ${player.adp.toFixed(1)}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Best Healthy Alternative */}
      {top3.length > 0 && isInjured(top3[0]) && bestHealthy && bestHealthy.name !== top3[0].name && (
        <div className="pt-6 border-t border-[#141e12]">
          <h4 className="text-sm font-semibold text-[#5a6b57] mb-3">Best Healthy</h4>
          <div
            className={`p-4 bg-[#050a05] border border-[#4a7c59] rounded-lg hover:bg-[#0a0f0a] transition-all ${
              draftComplete ? 'opacity-50' : 'cursor-pointer'
            }`}
            onClick={(e) => {
              if (draftComplete) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              onDraftPlayer?.(bestHealthy);
            }}
          >
            <div className="flex items-center gap-4">
              <div className="text-xs text-[#5a6b57] font-semibold w-10">
                #{bestHealthy.rank}
              </div>
              <TeamLogo team={bestHealthy.team} className="w-8 h-8" />
              <div className="flex-1">
                <div className="text-sm font-bold text-[#c8d9c3] mb-1">
                  {bestHealthy.name}
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {bestHealthy.team} • {bestHealthy.position}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-[#c8d9c3]">
                  {bestHealthy.projectedPlayoffPoints.toFixed(1)}
                </div>
                {(() => {
                  const round2Chance = bestHealthy.teamAdvancementOdds?.round2 ? bestHealthy.teamAdvancementOdds.round2 * 100 : null;
                  if (!round2Chance) return null;
                  return (
                    <div className={`text-xs px-2 py-0.5 rounded mt-1 font-medium ${
                      round2Chance >= 60 ? 'bg-[#1a3d1a] text-[#6b9b7a] border border-[#4a7c59]' :
                      round2Chance >= 40 ? 'bg-[#3d3d1a] text-[#9b9b6b] border border-[#7c7c4a]' :
                      'bg-[#3d1a1a] text-[#9b6b6b] border border-[#7c4a4a]'
                    }`}>
                      {round2Chance.toFixed(0)}% R2
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
