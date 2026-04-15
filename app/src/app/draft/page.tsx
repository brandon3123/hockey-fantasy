'use client';

import { useState, useEffect } from 'react';
import { Player, DraftState } from '@/types/player';
import { initializeDraft, assignPlayerToManager, getManagerPicks, getCurrentManager, getCurrentPickNumber } from '@/lib/draft-logic';
import DraftGrid from '@/components/DraftGrid';
import BestAvailable from '@/components/BestAvailable';
import TeamStackPanel from '@/components/TeamStackPanel';
import Link from 'next/link';

export default function DraftPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [managerNames, setManagerNames] = useState<string[]>([]);

  // Setup form state
  const [managers, setManagers] = useState(7);
  const [yourPosition, setYourPosition] = useState(1);
  const [playersPerTeam, setPlayersPerTeam] = useState(10);

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

    // Restore draft state if it exists
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
    const names = Array.from({ length: managers }, (_, i) =>
      i === yourPosition - 1 ? 'You' : `Manager ${i + 1}`
    );
    setDraftState(state);
    setManagerNames(names);
    localStorage.setItem('draftState', JSON.stringify(state));
    localStorage.setItem('managerNames', JSON.stringify(names));
    setSetupComplete(true);
  };

  const handleDraftPlayer = (player: Player) => {
    if (!draftState) return;

    console.log('Drafting player:', player.name, 'from', player.team);

    // Player.name is the unique identifier in this app (no separate id field)
    const newState = assignPlayerToManager(draftState, player.name, player.name);
    setDraftState(newState);
    // Save to localStorage
    localStorage.setItem('draftState', JSON.stringify(newState));

    console.log('Draft complete. New state:', {
      round: newState.currentRound,
      pick: newState.currentPick,
      totalPicks: newState.picks.length
    });
  };

  const handleResetDraft = () => {
    if (confirm('Are you sure you want to reset the draft? This will clear all draft progress and cannot be undone.')) {
      localStorage.removeItem('draftState');
      localStorage.removeItem('managerNames');
      setDraftState(null);
      setManagerNames([]);
      setSetupComplete(false);
    }
  };

  if (!setupComplete) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6">Draft Setup</h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Number of Managers
              </label>
              <select
                value={managers}
                onChange={(e) => setManagers(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border rounded-md"
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 3}>{i + 3} managers</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Your Draft Position
              </label>
              <select
                value={yourPosition}
                onChange={(e) => setYourPosition(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border rounded-md"
              >
                {Array.from({ length: managers }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Pick {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Players Per Team
              </label>
              <input
                type="number"
                min={5}
                max={20}
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <button
              onClick={handleSetupDraft}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
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

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Draft Board
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleResetDraft}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Reset Draft
            </button>
            <Link href="/" className="text-blue-600">
              Back to Rankings
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isYourTurn && (
          <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-lg text-blue-900 font-semibold">
            It&apos;s your turn! Pick #{currentPickNumber}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main draft grid */}
          <div className="lg:col-span-3">
            <DraftGrid draftState={draftState} managerNames={managerNames} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Best Available */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <BestAvailable
                availablePlayers={draftState.availablePlayers}
                currentPick={currentPickNumber}
                onDraftPlayer={handleDraftPlayer}
              />
            </div>

            {/* Team Stack */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <TeamStackPanel
                yourPicks={yourPicks}
                availablePlayers={draftState.availablePlayers}
                allPlayers={players}
                onDraftPlayer={handleDraftPlayer}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
