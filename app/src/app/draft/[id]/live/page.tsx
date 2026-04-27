'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useDraftState, DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import LivePlayerSidebar from '@/components/LivePlayerSidebar';
import TeamLogo from '@/components/TeamLogo';
import InjuryFlag from '@/components/InjuryFlag';
import { Player } from '@/types/player';

const teamLogos: Record<string, string> = {
  ANA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ana.png',
  BOS: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/bos.png',
  BUF: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/buf.png',
  CAR: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/car.png',
  COL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/col.png',
  DAL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/dal.png',
  EDM: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/edm.png',
  FLA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/fla.png',
  LAK: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/la.png',
  MIN: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/min.png',
  MTL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/mtl.png',
  NJD: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nj.png',
  NYI: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyi.png',
  NYR: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyr.png',
  OTT: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ott.png',
  PHI: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/phi.png',
  PIT: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/pit.png',
  TBL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tb.png',
  TOR: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tor.png',
  UTA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/uta.png',
  VAN: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/van.png',
  VGK: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/vgk.png',
  WPG: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/wpg.png',
};

function TeamLogoInline({ team }: { team: string }) {
  const url = teamLogos[team.toUpperCase()];
  if (!url) return <span className="text-[10px] text-[#5a6b57]">{team}</span>;
  return (
    <img
      src={url}
      alt={team}
      className="w-4 h-4 object-contain inline-block"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

function DraftBoardGrid({
  participants,
  picks,
  players,
  currentRound,
  currentPick,
  playersPerTeam,
  currentParticipant,
}: {
  participants: ParticipantData[];
  picks: DraftPickRow[];
  players: Player[];
  currentRound: number;
  currentPick: number;
  playersPerTeam: number;
  currentParticipant: ParticipantData | null;
}) {
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => (a.draft_position ?? 0) - (b.draft_position ?? 0)),
    [participants]
  );

  const managers = sortedParticipants.length;

  const getPickForCell = (participantId: string, round: number) => {
    const isReverse = round % 2 === 0;
    const pickNum = isReverse
      ? (round - 1) * managers + (managers - (sortedParticipants.findIndex(p => p.id === participantId)) + 1)
      : (round - 1) * managers + sortedParticipants.findIndex(p => p.id === participantId) + 1;

    return picks.find((p) => p.participant_id === participantId && p.round === round);
  };

  const isCurrentCell = (participantId: string, round: number) => {
    if (!currentParticipant) return false;
    return participantId === currentParticipant.id && round === currentRound;
  };

  const getProjectedPoints = (participantId: string) => {
    return picks
      .filter((p) => p.participant_id === participantId)
      .reduce((total, pick) => {
        const player = players.find((pl) => pl.name === pick.player_name);
        return total + (player?.projectedPlayoffPoints || 0);
      }, 0);
  };

  const getPlayerForPick = (pick: DraftPickRow) => {
    return players.find((pl) => pl.name === pick.player_name);
  };

  return (
    <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#4a7c59] text-[#c8d9c3]">
              <th className="px-3 py-2.5 text-left font-semibold text-xs border-r border-[#3d664a] whitespace-nowrap min-w-[120px]">
                MANAGER
              </th>
              {Array.from({ length: playersPerTeam }, (_, i) => (
                <th
                  key={i}
                  className="px-1 py-2.5 text-center font-semibold text-xs border-r border-[#3d664a] min-w-[70px]"
                >
                  R{i + 1}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold text-xs">PTS</th>
            </tr>
          </thead>
          <tbody>
            {sortedParticipants.map((participant) => {
              const isCurrentRow = currentParticipant?.id === participant.id;
              const projectedPts = getProjectedPoints(participant.id);

              return (
                <tr
                  key={participant.id}
                  className={`border-b border-[#141e12] ${
                    isCurrentRow ? 'bg-[#2a4a2a]' : 'bg-[#050a05]'
                  }`}
                >
                  <td className="px-3 py-2 border-r border-[#141e12]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold ${
                          isCurrentRow ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'
                        }`}
                      >
                        {participant.team_name}
                      </span>
                      {isCurrentRow && (
                        <span className="text-[10px] text-[#6b9b7a] animate-pulse">
                          &#9654;
                        </span>
                      )}
                    </div>
                  </td>
                  {Array.from({ length: playersPerTeam }, (_, roundIndex) => {
                    const round = roundIndex + 1;
                    const pick = getPickForCell(participant.id, round);
                    const isCell = isCurrentCell(participant.id, round);
                    const player = pick ? getPlayerForPick(pick) : null;

                    return (
                      <td
                        key={roundIndex}
                        className={`px-1 py-1 border-r border-[#141e12] text-center ${
                          isCell ? 'bg-[#1a2f1a]' : ''
                        }`}
                      >
                        {pick ? (
                          <div className="p-1 border border-[#141e12] bg-[#050a05] rounded">
                            <div className="text-[11px] font-medium text-[#c8d9c3] leading-tight truncate">
                              {pick.player_name}
                            </div>
                            <div className="flex items-center justify-center gap-0.5">
                              {player && <TeamLogoInline team={player.team} />}
                              <span className="text-[10px] text-[#5a6b57]">
                                {player?.position}
                              </span>
                            </div>
                          </div>
                        ) : isCell ? (
                          <div className="text-[11px] text-[#6b9b7a] animate-pulse font-semibold">
                            Picking...
                          </div>
                        ) : (
                          <div className="text-xs text-[#2d3c28]">-</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
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
  );
}

export default function LiveDraftPage() {
  const params = useParams();
  const draftId = params.id as string;
  const [picking, setPicking] = useState(false);

  const {
    draft,
    participants,
    picks,
    players,
    availablePlayers,
    loading,
    isAdmin,
    managers,
    currentRound,
    currentPick,
    currentParticipant,
    isDraftComplete,
    refresh,
  } = useDraftState(draftId);

  const handlePickPlayer = async (player: Player) => {
    if (!currentParticipant || picking) return;
    setPicking(true);

    try {
      const res = await fetch(`/api/drafts/${draftId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: currentParticipant.id,
          player_id: player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          player_name: player.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to make pick');
      }
      if (data.draft_complete) {
        refresh();
      }
    } catch (err) {
      alert('Failed to make pick');
    } finally {
      setPicking(false);
    }
  };

  const handleUndo = async () => {
    if (picks.length === 0) return;
    if (!confirm('Undo the last pick?')) return;

    try {
      const res = await fetch(`/api/drafts/${draftId}/picks/last`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to undo pick');
      }
      refresh();
    } catch (err) {
      alert('Failed to undo pick');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57] text-lg">Loading draft...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57] text-lg">Draft not found</div>
      </div>
    );
  }

  if (draft.status !== 'in_progress') {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#5a6b57] text-lg mb-2">
            Draft has not started yet
          </div>
          <div className="text-[#5a6b57] text-sm">
            Status: {draft.status}
          </div>
        </div>
      </div>
    );
  }

  const totalPicks = picks.length;
  const totalSlots = managers * (draft.players_per_team || 0);

  return (
    <div className="min-h-screen bg-[#050a05] flex flex-col">
      <div className="border-b border-[#141e12] bg-[#0a0f0a] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-[#c8d9c3]">
              {draft.name}
            </h1>
            <div className="text-sm text-[#5a6b57]">
              Round {currentRound} &bull; Pick {currentPick}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isDraftComplete ? (
              <div className="px-4 py-1.5 bg-[#4a7c59] rounded-lg text-sm font-bold text-[#c8d9c3]">
                DRAFT COMPLETE
              </div>
            ) : (
              <div className="px-4 py-1.5 bg-[#4a7c59] rounded-lg text-sm font-bold text-white animate-pulse">
                ON THE CLOCK: {currentParticipant?.team_name || '...'}
              </div>
            )}

            <div className="text-sm text-[#5a6b57]">
              {totalPicks}/{totalSlots} picks
            </div>

            {isAdmin && !isDraftComplete && (
              <button
                onClick={handleUndo}
                disabled={totalPicks === 0}
                className="px-3 py-1.5 text-xs font-medium text-[#c8d9c3] bg-[#050a05] border border-[#141e12] rounded-lg hover:bg-[#141e12] hover:border-[#4a7c59] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Undo Pick
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <DraftBoardGrid
            participants={participants}
            picks={picks}
            players={players}
            currentRound={currentRound}
            currentPick={currentPick}
            playersPerTeam={draft.players_per_team || 10}
            currentParticipant={currentParticipant}
          />
        </div>

        <LivePlayerSidebar
          availablePlayers={availablePlayers}
          currentParticipant={currentParticipant}
          participants={participants}
          isDraftComplete={isDraftComplete}
          pickTimerSeconds={draft.pick_timer_seconds}
          onPickPlayer={handlePickPlayer}
          loading={picking}
        />
      </div>
    </div>
  );
}
