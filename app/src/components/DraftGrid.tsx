'use client';

import { DraftState, DraftPick, Player } from '@/types/player';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import TeamLogo from './TeamLogo';
import InjuryFlag from './InjuryFlag';

interface DraftGridProps {
  draftState: DraftState;
  managerNames: string[];
  availablePlayers: Player[];
  onReplacePick: (pickIndex: number, newPlayer: Player) => void;
}

export default function DraftGrid({ draftState, managerNames, availablePlayers, onReplacePick }: DraftGridProps) {
  const { managers, yourPosition, yourParticipantId, currentRound, currentPick, picks } = draftState;
  const [selectedPick, setSelectedPick] = useState<DraftPick | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAvailablePlayers = searchTerm
    ? availablePlayers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.team.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : availablePlayers.slice(0, 100);

  // Get all currently drafted player names
  const draftedPlayerNames = new Set(picks.map(pick => pick.playerName));

  // Filter out already-drafted players from the replacement list
  const availableForReplacement = filteredAvailablePlayers.filter(p => !draftedPlayerNames.has(p.name));

  const grid: (DraftPick | null)[][] = [];

  for (let m = 0; m < managers; m++) {
    const row: (DraftPick | null)[] = [];
    for (let r = 1; r <= draftState.playersPerTeam; r++) {
      const pick = picks.find(
        p => p.participantId === `manager-${m}` && p.round === r
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
    return order[currentPick - 1] - 1;
  };

  const currentManager = getCurrentManagerIndex();
  const isYourTurn = currentManager === yourPosition - 1;

  const handlePickClick = (pick: DraftPick) => {
    setSelectedPick(pick);
    setShowReplaceModal(true);
  };

  const handleReplacePlayer = (newPlayer: Player) => {
    if (!selectedPick) return;

    // Find the exact pick by matching both player name AND manager index
    // This prevents replacing the wrong player when duplicates exist
    const pickIndex = picks.findIndex(p =>
      p.playerName === selectedPick.playerName &&
      p.participantId === selectedPick.participantId &&
      p.round === selectedPick.round
    );

    if (pickIndex !== -1) {
      onReplacePick(pickIndex, newPlayer);
      setShowReplaceModal(false);
      setSelectedPick(null);
      setSearchTerm('');
    }
  };

  const handleCloseModal = () => {
    setShowReplaceModal(false);
    setSelectedPick(null);
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Draft Grid Table */}
      <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#4a7c59] text-[#c8d9c3]">
                <th className="px-2 py-2 text-left font-semibold text-xs border-r border-[#3d664a] whitespace-nowrap">
                  MANAGER
                </th>
                {Array.from({ length: draftState.playersPerTeam }, (_, i) => (
                  <th key={i} className="px-1 py-2 text-center font-semibold text-xs border-r border-[#3d664a] min-w-[60px]">
                    R{i + 1}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-xs">
                  PTS
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, managerIndex) => {
                const isYourRow = `manager-${managerIndex}` === yourParticipantId;
                const isCurrentRow = managerIndex === currentManager;
                const managerPicks = picks.filter(p => p.participantId === `manager-${managerIndex}`);

                const projectedPts = managerPicks.reduce((total, pick) => {
                  const player = availablePlayers.find(p => p.name === pick.playerName);
                  return total + (player?.displayPoints || 0);
                }, 0);

                return (
                  <tr
                    key={managerIndex}
                    className={`border-b border-[#141e12] ${
                      isYourRow ? 'bg-[#1a2f1a]' : ''
                    } ${
                      isCurrentRow && !isYourRow ? 'bg-[#0a0f0a]' : ''
                    }`}
                  >
                    <td className={`px-2 py-2 border-r border-[#141e12] font-semibold text-xs ${
                      isYourRow ? 'text-[#4a7c59]' : 'text-[#c8d9c3]'
                    }`}>
                      <div className="flex items-center gap-1">
                        {managerNames[managerIndex] || `M${managerIndex + 1}`}
                        {isYourRow && <span className="text-[10px] text-[#4a7c59]">(YOU)</span>}
                        {isCurrentRow && !isYourRow && <span className="text-[10px] text-[#5a6b57]">←</span>}
                      </div>
                    </td>
                    {row.map((pick, roundIndex) => {
                      const isCurrentPick =
                        managerIndex === currentManager &&
                        roundIndex + 1 === currentRound;

                      const player = pick ? availablePlayers.find(p => p.name === pick.playerName) : null;

                      return (
                        <td
                          key={roundIndex}
                          className={`px-1 py-1 border-r border-[#141e12] text-center ${
                            isCurrentPick ? 'bg-[#0a0f0a]' : ''
                          }`}
                        >
                          {pick ? (
                            <div
                              onClick={() => handlePickClick(pick)}
                              className="cursor-pointer p-1 border border-[#141e12] bg-[#050a05] rounded hover:border-[#4a7c59] transition-all"
                              title="Click to replace this player"
                            >
                              <div className="text-xs font-medium text-[#c8d9c3] leading-tight">
                                {pick.playerName}
                              </div>
                              <div className="flex items-center justify-center gap-0.5">
                                {player && <TeamLogo team={player.team} className="w-3 h-3" />}
                                {player && (
                                  <span className="text-xs text-[#5a6b57]">
                                    {player.position}
                                  </span>
                                )}
                              </div>
                              {player && player.injury.status !== 'healthy' && (
                                <div className="flex justify-center mt-0.5">
                                  <InjuryFlag player={player} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-[#6b9b7a]">
                              -
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      <span className="text-xs font-bold text-[#6b9b7a]">
                        {projectedPts > 0 ? projectedPts.toFixed(1) : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replace Player Modal */}
      {showReplaceModal && selectedPick && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[200]">
          <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[#141e12] bg-[#8ab89a]">
              <h3 className="text-xl font-bold text-[#050a05] mb-2">
                Replace Player
              </h3>
              <div className="text-[#050a05]">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-lg font-semibold">{selectedPick.playerName}</div>
                    <div className="text-sm opacity-70">
                      {(() => {
                        const rowIdx = parseInt(selectedPick.participantId.replace('manager-', ''), 10);
                        return managerNames[rowIdx] || `Manager ${rowIdx + 1}`;
                      })()} | Round {selectedPick.round}
                    </div>
                  </div>
                  {(() => {
                    const currentPlayer = availablePlayers.find(p => p.name === selectedPick.playerName);
                    return currentPlayer && currentPlayer.injury.status !== 'healthy' && (
                      <div className="ml-auto">
                        <InjuryFlag player={currentPlayer} />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-[#141e12]">
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-[#141e12] rounded-lg bg-[#050a05] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
                autoFocus
              />
              {searchTerm && (
                <div className="text-sm text-[#5a6b57] mt-2">
                  Found: {filteredAvailablePlayers.length} players
                </div>
              )}
            </div>

            {/* Player List */}
            <div className="p-4 overflow-y-auto max-h-[400px]">
              {availableForReplacement
                .filter(p => p.name !== selectedPick.playerName)
                .slice(0, 20)
                .map(player => (
                  <div
                    key={`${player.name}-${player.team}-${player.position}`}
                    onClick={() => handleReplacePlayer(player)}
                    className="flex items-center gap-3 p-3 mb-2 border border-[#141e12] rounded-lg hover:border-[#4a7c59] hover:bg-[#0a0f0a] cursor-pointer transition-all"
                  >
                    <div className="text-sm text-[#5a6b57] font-semibold w-8">
                      #{player.rank}
                    </div>
                    <TeamLogo team={player.team} className="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-[#c8d9c3] truncate">
                          {player.name}
                        </div>
                        <InjuryFlag player={player} />
                      </div>
                      <div className="text-xs text-[#5a6b57]">
                        {player.team} • {player.position}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#6b9b7a]">
                        {player.displayPoints.toFixed(1)}
                        <span className="text-xs font-normal text-[#5a6b57] ml-1">proj</span>
                      </div>
                      <div className="text-xs text-[#5a6b57]">
                        {player.displayGames.toFixed(1)} gp
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-[#141e12] flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 text-sm font-medium text-[#5a6b57] bg-[#050a05] border border-[#141e12] rounded-lg hover:bg-[#141e12] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedPick) {
                    const bestAvailable = filteredAvailablePlayers
                      .filter(p => p.name !== selectedPick.playerName)
                      .sort((a, b) => b.displayPoints - a.displayPoints)[0];
                    if (bestAvailable) {
                      handleReplacePlayer(bestAvailable);
                    }
                  }
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
              >
                Auto-Pick Best
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}