'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ActionLink } from '@/components/ActionButton';
import { useDraftState, DraftPickRow, DraftData, ParticipantData } from '@/hooks/useDraftState';
import { Player, DraftState, DraftPick } from '@/types/player';
import MyTeamTab from '@/components/MyTeamTab';
import TeamBrowserTab from '@/components/TeamBrowserTab';
import DraftCoach from '@/components/DraftCoach';
import BestAvailable from '@/components/BestAvailable';
import PlayerList from '@/components/PlayerList';
import TeamStackPanel from '@/components/TeamStackPanel';
import DraftBoard from '@/components/DraftBoard';

type Tab = 'myteam' | 'coach' | 'best' | 'all' | 'stack' | 'teams' | 'board';

function mapToLegacyDraftState(
  draft: DraftData,
  participants: ParticipantData[],
  picks: DraftPickRow[],
  availablePlayers: Player[],
  adminPosition: number
): DraftState {
  const legacyPicks: DraftPick[] = picks.map((p) => ({
    playerId: p.player_id,
    playerName: p.player_name,
    round: p.round,
    managerIndex: p.manager_index,
  }));

  return {
    managers: participants.length,
    yourPosition: adminPosition,
    playersPerTeam: draft.players_per_team,
    currentRound: draft.current_round,
    currentPick: draft.current_pick,
    picks: legacyPicks,
    availablePlayers,
  };
}

export default function CoachPage() {
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

  const adminParticipant = useMemo(
    () => participants.find((p) => p.user_id === currentUserId),
    [participants, currentUserId]
  );

  const adminPosition = adminParticipant?.draft_position ?? 1;

  const legacyState = useMemo(
    () =>
      draft
        ? mapToLegacyDraftState(draft, participants, picks, availablePlayers, adminPosition)
        : null,
    [draft, participants, picks, availablePlayers, adminPosition]
  );

  const adminPicks = useMemo(
    () =>
      adminParticipant
        ? picks.filter((p) => p.participant_id === adminParticipant.id)
        : [],
    [picks, adminParticipant]
  );

  const handleDraftPlayer = async (player: Player) => {
    if (!adminParticipant || picking) return;
    setPicking(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: adminParticipant.id,
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

  if (!draft || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57]">Not available</div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'myteam', label: 'My Team' },
    { key: 'coach', label: 'Coach' },
    { key: 'best', label: 'Best' },
    { key: 'all', label: 'All' },
    { key: 'stack', label: 'Stack' },
    { key: 'teams', label: 'Teams' },
    { key: 'board', label: 'Board' },
  ];

  const overallPick = (currentRound - 1) * managers + currentPick;

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3] mb-2">{draft.name}</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-[#5a6b57]">
            <span>Admin View</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            {draft.status === 'in_progress' && !isDraftComplete ? (
              <span className="text-[#6b9b7a]">Round {currentRound}, Pick {currentPick}</span>
            ) : isDraftComplete ? (
              <span className="text-[#6b9b7a]">Draft Complete</span>
            ) : (
              <span>{draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}</span>
            )}
          </div>
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

          {activeTab === 'coach' && legacyState && (
            <DraftCoach
              draftState={legacyState}
              availablePlayers={availablePlayers}
              allPlayers={players}
              onDraftPlayer={handleDraftPlayer}
              draftComplete={isDraftComplete}
            />
          )}

          {activeTab === 'best' && (
            <BestAvailable
              availablePlayers={availablePlayers}
              currentPick={overallPick}
              onDraftPlayer={handleDraftPlayer}
              draftComplete={isDraftComplete}
            />
          )}

          {activeTab === 'all' && (
            <PlayerList
              availablePlayers={availablePlayers}
              onPickPlayer={handleDraftPlayer}
              isDraftComplete={isDraftComplete}
              showSearch={true}
            />
          )}

          {activeTab === 'stack' && (
            <TeamStackPanel
              yourPicks={adminPicks.map((p) => ({
                playerId: p.player_id,
                playerName: p.player_name,
                round: p.round,
    managerIndex: p.manager_index - 1,
              }))}
              availablePlayers={availablePlayers}
              allPlayers={players}
              onDraftPlayer={handleDraftPlayer}
              draftComplete={isDraftComplete}
            />
          )}

          {activeTab === 'teams' && (
            <TeamBrowserTab
              players={players}
              picks={picks}
              participants={participants}
              onDraftPlayer={handleDraftPlayer}
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
