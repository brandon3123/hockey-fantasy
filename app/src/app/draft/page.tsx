'use client';

import { useState, useEffect } from 'react';
import { Player, DraftState } from '@/types/player';
import { initializeDraft, assignPlayerToManager, getManagerPicks, getCurrentManager, getCurrentPickNumber, removeSpecificPick } from '@/lib/draft-logic';
import DraftGrid from '@/components/DraftGrid';
import BestAvailable from '@/components/BestAvailable';
import TeamStackPanel from '@/components/TeamStackPanel';
import FullPlayerList from '@/components/FullPlayerList';
import PositionTracker from '@/components/PositionTracker';
import TeamCompositionVisualizer from '@/components/TeamCompositionVisualizer';
import WatchlistToggle from '@/components/WatchlistToggle';
import DraftCoach from '@/components/DraftCoach';
import { STRATEGIES } from '@/lib/draft-coach';
import type { DraftStrategy } from '@/types/draft-coach';

export default function DraftPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [managerNames, setManagerNames] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'coach' | 'best' | 'full' | 'team' | 'positions' | 'visualizer'>('coach');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<DraftStrategy>(STRATEGIES.balanced);

  const [managers, setManagers] = useState(7);
  const [yourPosition, setYourPosition] = useState(1);
  const [playersPerTeam, setPlayersPerTeam] = useState(10);

  useEffect(() => {
    if (managerNames.length !== managers) {
      setManagerNames(Array.from({ length: managers }, (_, i) =>
        i === yourPosition - 1 ? 'You' : `Team ${i + 1}`
      ));
    }
  }, [managers, yourPosition]);

  useEffect(() => {
    const controller = new AbortController();

    const loadPlayers = async () => {
      try {
        const response = await fetch('/players.json', { signal: controller.signal });
        if (!response.ok) throw new Error(`Failed to load players: ${response.status}`);
        const data = await response.json();
        setPlayers(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err);
        }
      }
    };

    loadPlayers();

    // Load watchlist from localStorage
    try {
      const savedWatchlist = localStorage.getItem('watchlist');
      if (savedWatchlist) {
        setWatchlist(new Set(JSON.parse(savedWatchlist)));
      }
    } catch (e) {
      console.error('Failed to load watchlist:', e);
    }

    try {
      const savedDraft = localStorage.getItem('draftState');
      const savedNames = localStorage.getItem('managerNames');
      if (savedDraft) {
        setDraftState(JSON.parse(savedDraft));
        setSetupComplete(true);
      }
      if (savedNames) {
        setManagerNames(JSON.parse(savedNames));
      }
    } catch (e) {
      console.error('Failed to restore draft state:', e);
    }

    return () => controller.abort();
  }, []);

  const handleSetupDraft = () => {
    const state = initializeDraft({ managers, yourPosition, playersPerTeam }, players);
    const names = managerNames.length > 0
      ? managerNames
      : Array.from({ length: managers }, (_, i) =>
          i === yourPosition - 1 ? 'You' : `Team ${i + 1}`
        );
    setDraftState(state);
    localStorage.setItem('draftState', JSON.stringify(state));
    localStorage.setItem('managerNames', JSON.stringify(names));
    setSetupComplete(true);
  };

  const updateManagerName = (index: number, name: string) => {
    const newNames = [...managerNames];
    newNames[index] = name;
    setManagerNames(newNames);
    // Save to localStorage immediately
    localStorage.setItem('managerNames', JSON.stringify(newNames));
  };

  const handleDraftPlayer = (player: Player) => {
    if (!draftState) return;

    // Calculate total picks in draft
    const totalPicks = draftState.managers * draftState.playersPerTeam;
    const currentPicks = draftState.picks.length;

    // Prevent drafting after all picks are made
    if (currentPicks >= totalPicks) {
      console.log('❌ Draft is complete - cannot add more players');
      alert('The draft is complete! No more players can be added.');
      return;
    }

    // Get the current manager who is picking
    const currentManager = getCurrentManager(draftState);

    // Check if this manager already has this player
    const managerAlreadyHasPlayer = draftState.picks.some(
      pick => pick.playerName === player.name && pick.managerIndex === currentManager - 1
    );

    if (managerAlreadyHasPlayer) {
      alert(`${managerNames[currentManager - 1]} already has ${player.name}! Cannot add the same player twice.`);
      return;
    }

    // Check if player is already drafted by another team
    const playerAlreadyDrafted = draftState.picks.some(pick => pick.playerName === player.name);
    if (playerAlreadyDrafted) {
      const existingTeam = draftState.picks.find(pick => pick.playerName === player.name)?.managerIndex;
      alert(`${player.name} has already been drafted by ${managerNames[existingTeam!]}!`);
      return;
    }

    console.log(`✓ Adding ${player.name} to draft`);
    const newState = assignPlayerToManager(draftState, player.name, player.name);
    setDraftState(newState);
    localStorage.setItem('draftState', JSON.stringify(newState));
  };

  const handleDraftForCurrentManager = (player: Player) => {
    if (!draftState) return;

    // Calculate total picks in draft
    const totalPicks = draftState.managers * draftState.playersPerTeam;
    const currentPicks = draftState.picks.length;

    // Prevent drafting after all picks are made
    if (currentPicks >= totalPicks) {
      console.log('❌ Draft is complete - cannot add more players');
      alert('The draft is complete! No more players can be added.');
      return;
    }

    handleDraftPlayer(player);
  };

  const handleUndoPick = () => {
    if (!draftState) return;

    const lastPick = draftState.picks[draftState.picks.length - 1];
    if (!lastPick) return;

    const managerName = managerNames[lastPick.managerIndex];
    const isYourPick = lastPick.managerIndex === draftState.yourPosition - 1;

    const confirmMsg = isYourPick
      ? `Undo your pick of ${lastPick.playerName}?`
      : `Undo ${managerName}'s pick of ${lastPick.playerName}?`;

    if (confirm(confirmMsg)) {
      const { undoLastPick } = require('@/lib/draft-logic');
      const newState = undoLastPick(draftState, players);
      setDraftState(newState);
      localStorage.setItem('draftState', JSON.stringify(newState));
    }
  };

  const handleToggleWatchlist = (playerName: string) => {
    const newWatchlist = new Set(watchlist);
    if (newWatchlist.has(playerName)) {
      newWatchlist.delete(playerName);
    } else {
      newWatchlist.add(playerName);
    }
    setWatchlist(newWatchlist);
    localStorage.setItem('watchlist', JSON.stringify([...newWatchlist]));
  };

  const handleResetDraft = () => {
    if (confirm('Are you sure you want to reset the draft?')) {
      localStorage.removeItem('draftState');
      localStorage.removeItem('managerNames');
      setDraftState(null);
      setManagerNames([]);
      setSetupComplete(false);
    }
  };

  const handleReplacePick = (pickIndex: number, newPlayer: Player) => {
    if (!draftState) return;

    const pickToReplace = draftState.picks[pickIndex];

    // Check if the new player is already drafted by someone else
    const playerAlreadyDrafted = draftState.picks.some(
      pick => pick.playerName === newPlayer.name && pick.playerName !== pickToReplace.playerName
    );

    if (playerAlreadyDrafted) {
      alert(`${newPlayer.name} is already on another team!`);
      return;
    }

    const newState = removeSpecificPick(draftState, pickIndex, players);

    const newPick = {
      playerId: newPlayer.name,
      playerName: newPlayer.name,
      round: pickToReplace.round,
      managerIndex: pickToReplace.managerIndex,
    };

    const finalState = {
      ...newState,
      picks: [...newState.picks, newPick],
      availablePlayers: newState.availablePlayers.filter(p => p.name !== newPlayer.name),
    };

    setDraftState(finalState);
    localStorage.setItem('draftState', JSON.stringify(finalState));
  };

  const handleExportDraft = () => {
    if (!draftState) return;

    const draftData = {
      setup: {
        managers,
        yourPosition,
        playersPerTeam,
        managerNames,
      },
      picks: draftState.picks.map(pick => ({
        manager: managerNames[pick.managerIndex],
        round: pick.round,
        player: pick.playerName,
      })),
      timestamp: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(draftData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hockey-draft-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!draftState) return;

    let csv = 'Manager,Round,Player,Team,Position,Projected Points\\n';

    draftState.picks.forEach(pick => {
      const player = players.find(p => p.name === pick.playerName);
      csv += `"${managerNames[pick.managerIndex]}",${pick.round},"${pick.playerName}",`;
      csv += player ? `"${player.team}","${player.position}",${player.projectedPlayoffPoints.toFixed(1)}` : '","","",0';
      csv += '\\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hockey-draft-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!setupComplete) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-2xl w-full">
          <h1 className="text-3xl font-bold mb-6 text-center text-[#c8d9c3]">Draft Setup</h1>

          {/* Tips Section */}
          {showTips && (
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#c8d9c3]">💡 Draft Tips</h2>
                <button
                  onClick={() => setShowTips(false)}
                  className="text-[#5a6b57] hover:text-[#c8d9c3] font-semibold"
                >
                  ✕
                </button>
              </div>
              <ul className="space-y-2 text-sm text-[#5a6b57]">
                <li>• <strong>Fresh Data:</strong> Re-check Fantasy Pros most recent data before draft day for the latest rankings and injury updates</li>
                <li>• <strong>Team Stacking:</strong> Pick 2-3 teams you think will go deep in playoffs and load up on their players</li>
                <li>• <strong>Position Balance:</strong> Don't wait too long on centers - they tend to go faster than wingers</li>
                <li>• <strong>Injury Risk:</strong> Watch the injury flags - healthy players are safer early picks</li>
                <li>• <strong>ADP Value:</strong> Green numbers indicate players picked later than their average draft position (good value!)</li>
                <li>• <strong>PPG Focus:</strong> Points per game is more consistent than total season points for playoff performance</li>
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Number of Managers</label>
              <select
                value={managers}
                onChange={(e) => setManagers(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 3}>{i + 3} managers</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Your Draft Position</label>
              <select
                value={yourPosition}
                onChange={(e) => setYourPosition(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
              >
                {Array.from({ length: managers }, (_, i) => (
                  <option key={i} value={i + 1}>Pick {i + 1}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Players Per Team</label>
              <input
                type="number"
                min={5}
                max={20}
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
              />
            </div>

            {/* Manager Names Section */}
            <div className="border-t border-[#141e12] pt-4 mt-4">
              <label className="block text-sm font-medium mb-3 text-[#c8d9c3]">Team Names (Optional)</label>
              <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {Array.from({ length: managers }, (_, i) => (
                  <div key={i}>
                    <label className="block text-xs text-[#5a6b57] mb-1">
                      {i === yourPosition - 1 ? 'Your Team' : `Team ${i + 1}`}
                    </label>
                    <input
                      type="text"
                      value={managerNames[i] || (i === yourPosition - 1 ? 'You' : `Team ${i + 1}`)}
                      onChange={(e) => updateManagerName(i, e.target.value)}
                      placeholder={i === yourPosition - 1 ? 'Your Team Name' : `Team ${i + 1} Name`}
                      className="w-full px-3 py-2 border border-[#141e12] rounded-md text-sm bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSetupDraft}
              className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
            >
              Start Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!draftState) return null;

  const isDraftComplete = draftState.currentRound > draftState.playersPerTeam;
  const currentManager = !isDraftComplete ? getCurrentManager(draftState) : null;
  const isYourTurn = !isDraftComplete && currentManager === draftState.yourPosition;
  const yourPicks = getManagerPicks(draftState, draftState.yourPosition - 1);
  const currentPickNumber = getCurrentPickNumber(draftState);
  const canUndo = draftState.picks.length > 0 && !isDraftComplete;

  // Check for duplicate players across all teams
  const duplicateCheck: Record<string, string[]> = {};
  draftState.picks.forEach(pick => {
    if (!duplicateCheck[pick.playerName]) {
      duplicateCheck[pick.playerName] = [];
    }
    duplicateCheck[pick.playerName].push(managerNames[pick.managerIndex]);
  });

  const duplicates = Object.entries(duplicateCheck)
    .filter(([_, teams]) => teams.length > 1)
    .map(([player, teams]) => ({ player, teams }));

  return (
    <div className="min-h-screen bg-[#050a05] flex flex-col">
      {/* Header - Compact with team stats */}
      <div className="px-4 py-3 border-b border-[#141e12]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-[#c8d9c3]">Draft Board</h1>
            <p className="text-sm text-[#5a6b57]">
              {!isDraftComplete ? (
                <span className="font-semibold text-[#6b9b7a]">
                  {isYourTurn ? 'Your Turn!' : `${managerNames[(currentManager || 1) - 1]}'s Turn`}
                </span>
              ) : (
                <span className="text-[#6b9b7a] font-semibold">🎉 Draft Complete! 🎉</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {canUndo && (
              <button
                onClick={handleUndoPick}
                className="px-3 py-1.5 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
              >
                Undo
              </button>
            )}
            <button
              onClick={handleResetDraft}
              className="px-3 py-1.5 text-sm font-medium text-[#5a6b57] border border-[#141e12] rounded-lg hover:bg-[#141e12] transition-colors"
            >
              Reset
            </button>
            {isDraftComplete && (
              <>
                <button
                  onClick={handleExportDraft}
                  className="px-3 py-1.5 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
                >
                  Export
                </button>
              </>
            )}
          </div>
        </div>

      {/* Duplicate Player Warning */}
      {duplicates.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-2 text-sm">
          <div className="font-semibold mb-1">⚠️ Duplicate Players Detected!</div>
          <div className="space-y-1">
            {duplicates.map(({ player, teams }) => (
              <div key={player}>
                <strong>{player}</strong> appears on: {teams.join(', ')}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs">Use "Reset Draft" to fix this issue.</div>
        </div>
      )}

      {/* Compact Team Stats Bar */}
        {yourPicks.length > 0 && (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#5a6b57]">Your Picks:</span>
              <span className="font-semibold text-[#c8d9c3]">{yourPicks.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#5a6b57]">Proj Pts:</span>
              <span className="font-semibold text-[#6b9b7a]">
                {yourPicks.reduce((sum, pick) => {
                  const player = players.find(p => p.name === pick.playerName);
                  return sum + (player?.projectedPlayoffPoints || 0);
                }, 0).toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(['C', 'LW', 'RW', 'D', 'G'] as const).map(pos => {
                const count = yourPicks.filter(pick => {
                  const player = players.find(p => p.name === pick.playerName);
                  return player?.position === pos;
                }).length;

                return (
                  <div key={pos} className="flex items-center gap-1">
                    <span className="text-[#5a6b57]">{pos}:</span>
                    <span className={`font-semibold ${count > 0 ? 'text-[#c8d9c3]' : 'text-[#5a6b57]'}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden items-start">
        {/* Draft Board - Center (75%) */}
        <div className="flex-1 overflow-auto p-4">
          <DraftGrid
            draftState={draftState}
            managerNames={managerNames}
            availablePlayers={players}
            onReplacePick={handleReplacePick}
          />
        </div>

        {/* Right Column - Player Selection (25%) */}
        <div className="w-96 shrink-0 border-l border-[#141e12] bg-[#0a0f0a] flex flex-col relative z-10">
          {/* Tabs - Outside scroll area */}
          <div className="p-2 border-b border-[#141e12] shrink-0">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('coach')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'coach'
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                Coach
              </button>
              <button
                onClick={() => setActiveTab('best')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'best'
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                Best
              </button>
              <button
                onClick={() => setActiveTab('full')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'full'
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                All
              </button>
            </div>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => setActiveTab('team')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'team'
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                Stack
              </button>
              <button
                onClick={() => setActiveTab('positions')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'positions'
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                Pos
              </button>
              <button
                onClick={() => setActiveTab('visualizer')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'visualizer'
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                Visual
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="overflow-y-auto p-4">
            {activeTab === 'coach' && (
              <div className="w-full">
                <DraftCoach
                  draftState={draftState}
                  availablePlayers={players}
                  onDraftPlayer={handleDraftForCurrentManager}
                  draftComplete={draftState.picks.length >= draftState.managers * draftState.playersPerTeam}
                />
              </div>
            )}

            {activeTab === 'best' && (
              <BestAvailable
                availablePlayers={draftState.availablePlayers}
                currentPick={currentPickNumber}
                onDraftPlayer={handleDraftForCurrentManager}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                draftComplete={isDraftComplete}
              />
            )}

            {activeTab === 'full' && (
              <FullPlayerList
                availablePlayers={draftState.availablePlayers}
                currentPick={currentPickNumber}
                onDraftPlayer={handleDraftForCurrentManager}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                draftComplete={isDraftComplete}
              />
            )}

            {activeTab === 'team' && (
              <TeamStackPanel
                yourPicks={yourPicks}
                availablePlayers={draftState.availablePlayers}
                allPlayers={players}
                onDraftPlayer={handleDraftForCurrentManager}
                draftComplete={isDraftComplete}
              />
            )}

            {activeTab === 'positions' && (
              <PositionTracker
                draftState={draftState}
                allPlayers={players}
              />
            )}

            {activeTab === 'visualizer' && (
              <TeamCompositionVisualizer
                draftState={draftState}
                allPlayers={players}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}