'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useDraftState } from '@/hooks/useDraftState';
import Link from 'next/link';
import { ActionLink } from '@/components/ActionButton';
import { Player } from '@/types/player';
import MyTeamTab from '@/components/MyTeamTab';
import TeamBrowserTab from '@/components/TeamBrowserTab';
import DraftBoard from '@/components/DraftBoard';
import PlayerList from '@/components/PlayerList';

type Tab = 'myteam' | 'available' | 'teams' | 'board';

export default function TeamPage() {
  const params = useParams();
  const draftId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>('myteam');
  const [picking, setPicking] = useState(false);

  const {
    draft,
    participants,
    picks,
    players,
    availablePlayers,
    playoffTeams,
    loading,
    isAdmin,
    currentUserId,
    managers,
    currentRound,
    currentPick,
    currentParticipant,
    isDraftComplete,
    refresh,
  } = useDraftState(draftId);

  const myParticipant = useMemo(
    () => participants.find((p) => p.user_id === currentUserId),
    [participants, currentUserId]
  );

  const isMyTurn = currentParticipant?.user_id === currentUserId;
  const isSelfDraft = draft?.pick_entry_mode === 'self_draft';

  const handleDraftPlayer = async (player: Player) => {
    if (!myParticipant || picking || !isSelfDraft) return;
    setPicking(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: myParticipant.id,
          player_id: `${player.name}-${player.team}-${player.position}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          player_name: player.name,
        }),
      });
      if (res.ok) {
        refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to make pick');
      }
    } catch {
      alert('Failed to make pick');
    } finally {
      setPicking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#5a6b57] text-lg mb-2">Draft not found</div>
          <Link href="/" className="text-sm text-[#6b9b7a] hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#c8d9c3] text-lg mb-2">Sign in to view your team</div>
          <Link href="/auth/login" className="text-sm text-[#6b9b7a] hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!myParticipant) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#c8d9c3] text-lg mb-2">You&apos;re not in this draft</div>
          <Link href="/" className="text-sm text-[#6b9b7a] hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'myteam', label: 'My Team' },
    { key: 'available', label: 'Available' },
    { key: 'teams', label: 'Teams' },
    { key: 'board', label: 'Board' },
  ];

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3] mb-2">{draft.name}</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-[#5a6b57]">
            {draft.status === 'in_progress' && !isDraftComplete ? (
              <span className="text-[#6b9b7a]">Round {currentRound}, Pick {currentPick}</span>
            ) : isDraftComplete ? (
              <span className="text-[#6b9b7a]">Draft Complete</span>
            ) : (
              <span>{draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}</span>
            )}
          </div>
          {draft.status === 'in_progress' && !isDraftComplete && (
            <div className="mt-3">
              {isMyTurn ? (
                <div className="inline-block px-6 py-2 bg-[#4a7c59] rounded-lg text-sm font-bold text-white animate-pulse">
                  Your turn!
                </div>
              ) : (
                <div className="inline-block px-6 py-2 bg-[#0a0f0a] border border-[#141e12] rounded-lg text-sm text-[#5a6b57]">
                  On the clock: {currentParticipant?.team_name || '...'}
                </div>
              )}
            </div>
          )}
          {isDraftComplete && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <ActionLink
                href={`/draft/${draftId}/results`}
                variant="primary"
                className="px-4 py-2 text-sm"
              >
                View Results
              </ActionLink>
              <ActionLink
                href={`/draft/${draftId}/standings`}
                variant="secondary"
                className="px-4 py-2 text-sm"
              >
                Standings
              </ActionLink>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px flex-1 bg-[#1a2f1a]" />
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#4a7c59] text-[#c8d9c3]'
                    : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="h-px flex-1 bg-[#1a2f1a]" />
        </div>

        <div>
          {activeTab === 'myteam' && (
            <MyTeamTab
              picks={picks}
              participants={participants}
              players={players}
              currentUserId={currentUserId}
              draft={draft}
              currentRound={currentRound}
              currentPick={currentPick}
              managers={managers}
            />
          )}

          {activeTab === 'available' && (
            <>
              {draft.pick_entry_mode === 'admin_only' && !isDraftComplete && !isMyTurn && (
                <div className="mb-4">
                  <div className="px-4 py-2 bg-[#0a0f0a] border border-[#141e12] rounded-lg text-center text-sm text-[#5a6b57]">
                    Tell the admin your pick!
                  </div>
                </div>
              )}
              <PlayerList
                availablePlayers={availablePlayers}
                onPickPlayer={isSelfDraft ? handleDraftPlayer : undefined}
                isDraftComplete={isDraftComplete}
                showSearch={true}
              />
            </>
          )}

          {activeTab === 'teams' && (
            <TeamBrowserTab
              players={players}
              picks={picks}
              participants={participants}
              onDraftPlayer={isSelfDraft ? handleDraftPlayer : undefined}
              isDraftComplete={isDraftComplete}
              seasonType={draft?.season_type ?? 'playoffs'}
              playoffTeams={playoffTeams}
            />
          )}

          {activeTab === 'board' && (
            <DraftBoard
              draftId={draftId}
              participants={participants}
              picks={picks}
              players={players}
              playersPerTeam={draft.players_per_team}
              currentRound={currentRound}
              currentParticipant={currentParticipant}
              isDraftComplete={isDraftComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
