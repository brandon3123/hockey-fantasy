'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useDraftState, DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import { Player } from '@/types/player';
import MyTeamTab from '@/components/MyTeamTab';
import TeamBrowserTab from '@/components/TeamBrowserTab';
import TeamLogo from '@/components/TeamLogo';
import FullPlayerList from '@/components/FullPlayerList';
import Link from 'next/link';

type Tab = 'myteam' | 'available' | 'teams' | 'board';

function MiniDraftBoard({
  participants,
  picks,
  players,
  playersPerTeam,
  currentRound,
  currentParticipant,
}: {
  participants: ParticipantData[];
  picks: DraftPickRow[];
  players: Player[];
  playersPerTeam: number;
  currentRound: number;
  currentParticipant: ParticipantData | null;
}) {
  const sorted = useMemo(
    () => [...participants].sort((a, b) => (a.draft_position ?? 0) - (b.draft_position ?? 0)),
    [participants]
  );

  return (
    <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#4a7c59] text-[#c8d9c3]">
              <th className="px-2 py-1.5 text-left font-semibold border-r border-[#3d664a] whitespace-nowrap">
                MGR
              </th>
              {Array.from({ length: playersPerTeam }, (_, i) => (
                <th key={i} className="px-1 py-1.5 text-center font-semibold border-r border-[#3d664a] min-w-[50px]">
                  R{i + 1}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center font-semibold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((participant) => {
              const isCurrent = currentParticipant?.id === participant.id;
              const pts = picks
                .filter((p) => p.participant_id === participant.id)
                .reduce((total, pick) => {
                  const player = players.find((pl) => pl.name === pick.player_name);
                  return total + (player?.displayPoints || 0);
                }, 0);
              return (
                <tr key={participant.id} className={`border-b border-[#141e12] ${isCurrent ? 'bg-[#2a4a2a]' : 'bg-[#050a05]'}`}>
                  <td className="px-2 py-1 border-r border-[#141e12]">
                    <span className={`text-xs font-semibold ${isCurrent ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                      {participant.team_name}
                    </span>
                  </td>
                  {Array.from({ length: playersPerTeam }, (_, roundIndex) => {
                    const round = roundIndex + 1;
                    const pick = picks.find((p) => p.participant_id === participant.id && p.round === round);
                    const isCell = isCurrent && round === currentRound;
                    const player = pick ? players.find((pl) => pl.name === pick.player_name) : null;
                    return (
                      <td key={roundIndex} className={`px-0.5 py-1 border-r border-[#141e12] text-center ${isCell ? 'bg-[#1a2f1a]' : ''}`}>
                        {pick ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-[10px] text-[#c8d9c3] truncate max-w-[50px]">
                              {pick.player_name.split(' ').pop()}
                            </span>
                            {player && (
                              <TeamLogo team={player.team} className="w-3 h-3" />
                            )}
                          </div>
                        ) : isCell ? (
                          <div className="text-[10px] text-[#6b9b7a] animate-pulse font-semibold">Picking...</div>
                        ) : (
                          <span className="text-[#2d3c28]">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-center">
                    <span className="text-xs font-bold text-[#6b9b7a]">
                      {pts > 0 ? pts.toFixed(1) : '-'}
                    </span>
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
          <Link href="/dashboard" className="text-sm text-[#6b9b7a] hover:underline">
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
          <Link href="/dashboard" className="text-sm text-[#6b9b7a] hover:underline">
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
    <div className="min-h-screen bg-[#050a05] flex flex-col">
      <div className="border-b border-[#141e12] bg-[#0a0f0a] px-4 py-3">
        <div className="text-lg font-bold text-[#c8d9c3]">{draft.name}</div>
        {draft.status === 'in_progress' && !isDraftComplete && (
          <div className="text-sm text-[#6b9b7a] mt-1">
            Round {currentRound}, Pick {currentPick}
          </div>
        )}
        {isDraftComplete && (
          <div className="text-sm text-[#6b9b7a] mt-1">Draft Complete</div>
        )}
      </div>

      {draft.status === 'in_progress' && !isDraftComplete && (
        <div className="px-4 py-2">
          {isMyTurn ? (
            <div className="px-4 py-2 bg-[#4a7c59] rounded-lg text-center text-sm font-bold text-white animate-pulse">
              Your turn!
            </div>
          ) : (
            <div className="px-4 py-2 bg-[#0a0f0a] border border-[#141e12] rounded-lg text-center text-sm text-[#5a6b57]">
              On the clock: {currentParticipant?.team_name || '...'}
            </div>
          )}
        </div>
      )}

      {draft.status !== 'in_progress' && !isDraftComplete && (
        <div className="px-4 py-2">
          <div className="px-4 py-2 bg-[#0a0f0a] border border-[#141e12] rounded-lg text-center text-sm text-[#5a6b57]">
            Waiting for draft to start...
          </div>
        </div>
      )}

      <div className="flex gap-1 px-2 py-2 border-b border-[#141e12] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-[#4a7c59] text-[#c8d9c3]'
                : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
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
          <div>
            {!isSelfDraft && (
              <div className="mb-3 px-3 py-2 bg-[#0a0f0a] border border-[#141e12] rounded-lg text-xs text-[#5a6b57]">
                Tell the admin your pick
              </div>
            )}
            <FullPlayerList
              availablePlayers={availablePlayers}
              currentPick={(currentRound - 1) * managers + currentPick}
              onDraftPlayer={isSelfDraft ? handleDraftPlayer : () => {}}
              draftComplete={isDraftComplete}
            />
          </div>
        )}

        {activeTab === 'teams' && (
          <TeamBrowserTab
            players={players}
            picks={picks}
            participants={participants}
            onDraftPlayer={isSelfDraft ? handleDraftPlayer : undefined}
            isDraftComplete={isDraftComplete}
            seasonType={draft?.season_type ?? 'playoffs'}
          />
        )}

        {activeTab === 'board' && (
          <div>
            <div className="text-xs text-[#5a6b57] mb-3">Viewing draft board</div>
            <MiniDraftBoard
              participants={participants}
              picks={picks}
              players={players}
              playersPerTeam={draft.players_per_team}
              currentRound={currentRound}
              currentParticipant={currentParticipant}
            />
          </div>
        )}
      </div>
    </div>
  );
}
