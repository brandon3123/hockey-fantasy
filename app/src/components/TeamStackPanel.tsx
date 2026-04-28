'use client';

import { Player, DraftPick } from '@/types/player';
import { cn } from '@/lib/utils';
import TeamLogo from '@/components/TeamLogo';
import { isPlayerPickable } from './InjuryFlag';

interface TeamStackPanelProps {
  yourPicks: DraftPick[];
  availablePlayers: Player[];
  allPlayers: Player[];
  onDraftPlayer?: (player: Player) => void;
  draftComplete?: boolean;
}

export default function TeamStackPanel({
  yourPicks,
  availablePlayers,
  allPlayers,
  onDraftPlayer,
  draftComplete = false
}: TeamStackPanelProps) {
  // Count players per team from your picks
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
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold mb-2 text-[#c8d9c3]">Team Stack</h3>
          <div className="w-full h-px bg-[#141e12]"></div>
        </div>
        <div className="bg-[#050a05] p-6 text-center rounded-lg border border-[#141e12]">
          <div className="text-sm text-[#5a6b57]">Draft players to see team stacking options</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold mb-2 text-[#c8d9c3]">Team Stack</h3>
        <div className="w-full h-px bg-[#141e12]"></div>
        <p className="text-xs text-[#5a6b57] mt-4">Your top invested teams</p>
      </div>

      {sortedTeams.map(([team, count], index) => {
        const teammates = availablePlayers
          .filter(p => p.team === team)
          .sort((a, b) => b.displayPoints - a.displayPoints);

        return (
          <div key={team} className="bg-[#050a05] border border-[#141e12] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm bg-[#4a7c59] text-[#c8d9c3] shrink-0">
                  #{index + 1}
                </div>
                <div className="flex items-center gap-2">
                  <TeamLogo team={team} className="w-8 h-8" />
                  <div>
                    <div className="text-sm font-bold text-[#c8d9c3]">{team}</div>
                    <div className="text-xs text-[#5a6b57]">{count} player{count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-[#5a6b57]">{teammates.length} avail</div>
            </div>

            {teammates.length > 0 ? (
              <div className="space-y-2">
                {teammates.slice(0, 5).map((player) => (
                  <div
                    key={`${player.name}-${player.team}-${player.position}`}
                    onClick={(e) => {
                      if (draftComplete || !isPlayerPickable(player)) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      onDraftPlayer?.(player);
                    }}
                    className={`flex items-center gap-2 p-2 bg-[#0a0f0a] border border-[#141e12] rounded hover:border-[#4a7c59] transition-all ${
                      draftComplete ? 'opacity-50' : !isPlayerPickable(player) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="text-xs text-[#5a6b57] font-semibold w-10 shrink-0">#{player.rank}</div>
                    <TeamLogo team={player.team} className="w-5 h-5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#c8d9c3] truncate">{player.name}</div>
                      <div className="text-xs text-[#5a6b57]">{player.position}</div>
                    </div>
                    <div className="text-sm font-bold text-[#6b9b7a] shrink-0">
                      {player.displayPoints.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded">
                <div className="text-xs text-[#5a6b57]">No teammates available</div>
              </div>
            )}
          </div>
        );
      })}

      <div className="border border-[#141e12] p-4 text-center rounded-lg">
        <div className="text-xs text-[#5a6b57]">
          Pick 2-3 teams you think will go deep and load up on their players
        </div>
      </div>
    </div>
  );
}