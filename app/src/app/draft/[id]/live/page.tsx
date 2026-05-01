'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDraftState, DraftPickRow, ParticipantData } from '@/hooks/useDraftState';
import PlayerList from '@/components/PlayerList';
import TeamBrowserTab from '@/components/TeamBrowserTab';
import TeamLogo from '@/components/TeamLogo';
import InjuryFlag from '@/components/InjuryFlag';
import { Player } from '@/types/player';

const teamLogos: Record<string, string> = {
  ANA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ana.png',
  BOS: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/bos.png',
  BUF: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/buf.png',
  CAR: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/car.png',
  CBJ: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/cbj.png',
  CGY: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/cgy.png',
  CHI: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/chi.png',
  COL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/col.png',
  DAL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/dal.png',
  DET: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/det.png',
  EDM: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/edm.png',
  FLA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/fla.png',
  LAK: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/la.png',
  MIN: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/min.png',
  MTL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/mtl.png',
  NJD: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nj.png',
  NSH: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nsh.png',
  NYI: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyi.png',
  NYR: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/nyr.png',
  OTT: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/ott.png',
  PHI: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/phi.png',
  PIT: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/pit.png',
  SEA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/sea.png',
  SJS: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/sj.png',
  STL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/stl.png',
  TBL: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tb.png',
  TOR: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/tor.png',
  UTA: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/uta.png',
  VAN: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/van.png',
  VGK: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/vgk.png',
  WPG: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/wpg.png',
  WSH: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/wsh.png',
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

function ReplacePickModal({
  pick,
  availablePlayers,
  participantName,
  onReplace,
  onClose,
  replacing,
}: {
  pick: DraftPickRow;
  availablePlayers: Player[];
  participantName: string;
  onReplace: (newPlayer: Player) => void;
  onClose: () => void;
  replacing: boolean;
}) {
  const [search, setSearch] = useState('');

  const currentPlayer = availablePlayers.find((p) => p.name === pick.player_name);

  const draftedNames = useMemo(() => {
    const names = new Set<string>();
    names.add(pick.player_name.toLowerCase());
    return names;
  }, [pick]);

  const filtered = useMemo(() => {
    let result = availablePlayers.filter((p) => !draftedNames.has(p.name.toLowerCase()));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }
    return result.slice(0, 50);
  }, [availablePlayers, search, draftedNames]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-[#141e12] bg-[#8ab89a]">
          <h3 className="text-xl font-bold text-[#050a05] mb-2">Replace Player</h3>
          <div className="text-[#050a05]">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-lg font-semibold">{pick.player_name}</div>
                <div className="text-sm opacity-70">
                  {participantName} | Round {pick.round}
                </div>
              </div>
              {currentPlayer && currentPlayer.injury.status !== 'healthy' && (
                <div className="ml-auto">
                  <InjuryFlag player={currentPlayer} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-[#141e12]">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-[#141e12] rounded-lg bg-[#050a05] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
            autoFocus
          />
          {search && (
            <div className="text-sm text-[#5a6b57] mt-2">
              Found: {filtered.length} players
            </div>
          )}
        </div>

        <div className="overflow-y-auto max-h-[400px]">
          {filtered.map((player) => (
            <div
              key={`${player.name}-${player.team}-${player.position}`}
              onClick={() => !replacing && onReplace(player)}
              className={`flex items-center gap-3 p-3 border-b border-[#141e12] hover:border-[#4a7c59] hover:bg-[#0a0f0a] transition-all ${
                replacing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div className="text-sm text-[#5a6b57] font-semibold w-8">#{player.rank}</div>
              <TeamLogo team={player.team} className="w-8 h-8" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#c8d9c3] truncate">
                    {player.name}
                  </span>
                  <InjuryFlag player={player} />
                </div>
                <div className="text-xs text-[#5a6b57]">
                  {player.team} &bull; {player.position}
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

        <div className="p-4 border-t border-[#141e12] flex gap-3">
          <button
            onClick={onClose}
            disabled={replacing}
            className="flex-1 px-4 py-2 text-sm font-medium text-[#5a6b57] bg-[#050a05] border border-[#141e12] rounded-lg hover:bg-[#141e12] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (filtered.length > 0) onReplace(filtered[0]);
            }}
            disabled={replacing || filtered.length === 0}
            className="flex-1 px-4 py-2 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors disabled:opacity-50"
          >
            {replacing ? 'Replacing...' : 'Auto-Pick Best'}
          </button>
        </div>
      </div>
    </div>
  );
}

type SidebarTab = 'players' | 'teams';

function DraftBoardGrid({
  participants,
  picks,
  players,
  currentRound,
  currentPick,
  playersPerTeam,
  currentParticipant,
  onPickClick,
}: {
  participants: ParticipantData[];
  picks: DraftPickRow[];
  players: Player[];
  currentRound: number;
  currentPick: number;
  playersPerTeam: number;
  currentParticipant: ParticipantData | null;
  onPickClick: (pick: DraftPickRow) => void;
}) {
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => (a.draft_position ?? 0) - (b.draft_position ?? 0)),
    [participants]
  );

  const getPickForCell = (participantId: string, round: number) => {
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
        return total + (player?.displayPoints || 0);
      }, 0);
  };

  const getPlayerForPick = (pick: DraftPickRow) => {
    return players.find((pl) => pl.name === pick.player_name);
  };

  const renderPickCell = (pick: DraftPickRow | undefined, isCell: boolean, player: Player | null | undefined) => {
    if (pick) {
      return (
        <div
          onClick={() => onPickClick(pick)}
          className="cursor-pointer p-1 border border-[#141e12] bg-[#050a05] rounded hover:border-[#4a7c59] transition-all"
          title="Click to replace this player"
        >
          <div className="text-xs font-medium text-[#c8d9c3] leading-tight truncate">
            {pick.player_name}
          </div>
          <div className="flex items-center justify-center gap-0.5">
            {player && <TeamLogoInline team={player.team} />}
            <span className="text-xs text-[#5a6b57]">
              {player?.position}
            </span>
          </div>
          {player && player.injury.status !== 'healthy' && (
            <div className="flex justify-center mt-0.5">
              <InjuryFlag player={player} />
            </div>
          )}
        </div>
      );
    }
    if (isCell) {
      return (
        <div className="text-xs text-[#6b9b7a] animate-pulse font-semibold">
          Picking...
        </div>
      );
    }
    return <div className="text-xs text-[#2d3c28]">-</div>;
  };

  return (
    <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] overflow-hidden">
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#4a7c59] text-[#c8d9c3]">
              <th className="px-3 py-2.5 text-left font-semibold text-xs border-r border-[#3d664a] whitespace-nowrap min-w-[80px]">
                MANAGER
              </th>
              {Array.from({ length: playersPerTeam }, (_, i) => (
                <th
                  key={i}
                  className="px-1 py-2.5 text-center font-semibold text-xs border-r border-[#3d664a] min-w-[50px]"
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
                        <span className="text-xs text-[#6b9b7a] animate-pulse">
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
                        className={`px-1 py-2 border-r border-[#141e12] text-center ${
                          isCell ? 'bg-[#1a2f1a]' : ''
                        }`}
                      >
                        {renderPickCell(pick, isCell, player)}
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

      <div className="lg:hidden">
        {Array.from({ length: playersPerTeam }, (_, roundIndex) => {
          const round = roundIndex + 1;
          const isCurrentRound = round === currentRound;

          return (
            <div key={roundIndex} className={isCurrentRound ? 'bg-[#1a2f1a]' : ''}>
              <div className={`px-3 py-2 flex items-center justify-between border-b border-[#141e12] ${isCurrentRound ? 'bg-[#2a4a2a]' : 'bg-[#0a0f0a]'}`}>
                <span className={`text-xs font-bold ${isCurrentRound ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                  Round {round}
                </span>
                {isCurrentRound && (
                  <span className="text-xs text-[#6b9b7a] animate-pulse">&#9654;</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#141e12]">
                {sortedParticipants.map((participant) => {
                  const pick = getPickForCell(participant.id, round);
                  const isCell = isCurrentCell(participant.id, round);
                  const player = pick ? getPlayerForPick(pick) : null;

                  return (
                    <div
                      key={participant.id}
                      className={`bg-[#050a05] p-2 ${isCell ? 'bg-[#1a2f1a]' : ''}`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className={`text-[11px] font-semibold truncate ${currentParticipant?.id === participant.id ? 'text-[#6b9b7a]' : 'text-[#5a6b57]'}`}>
                          {participant.team_name}
                        </span>
                      </div>
                      {renderPickCell(pick, isCell, player)}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="px-3 py-2 border-t border-[#141e12] bg-[#0a0f0a]">
          <div className="grid grid-cols-2 gap-2">
            {sortedParticipants.map((participant) => {
              const projectedPts = getProjectedPoints(participant.id);
              return (
                <div key={participant.id} className="flex items-center justify-between">
                  <span className="text-xs text-[#5a6b57] truncate">{participant.team_name}</span>
                  <span className="text-xs font-bold text-[#6b9b7a]">
                    {projectedPts > 0 ? projectedPts.toFixed(1) : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveDraftPage() {
  const params = useParams();
  const draftId = params.id as string;
  const [picking, setPicking] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('players');
  const [replacePick, setReplacePick] = useState<DraftPickRow | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [mobileBoardTab, setMobileBoardTab] = useState<'board' | 'players'>('board');

  const {
    draft,
    participants,
    picks,
    players,
    availablePlayers,
    playoffTeams,
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
          player_id: `${player.name}-${player.team}-${player.position}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          player_name: player.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to make pick');
      }
      refresh();
    } catch (err) {
      alert('Failed to make pick');
    } finally {
      setPicking(false);
    }
  };

  const handleUndo = async () => {
    if (picks.length === 0) return;

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

  const handleReset = async () => {
    try {
      const res = await fetch(`/api/drafts/${draftId}/reset`, {
        method: 'POST',
      });
      if (res.ok) {
        window.location.href = `/dashboard/drafts/${draftId}`;
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset draft');
      }
    } catch {
      alert('Failed to reset draft');
    }
  };

  const handleReplacePick = async (newPlayer: Player) => {
    if (!replacePick || replacing) return;
    setReplacing(true);

    try {
      const res = await fetch(`/api/drafts/${draftId}/picks/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pick_id: replacePick.id,
          new_player_id: `${newPlayer.name}-${newPlayer.team}-${newPlayer.position}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          new_player_name: newPlayer.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to replace pick');
      }

      setReplacePick(null);
      refresh();
    } catch {
      alert('Failed to replace pick');
    } finally {
      setReplacing(false);
    }
  };

  const replacePickParticipant = useMemo(() => {
    if (!replacePick) return '';
    const p = participants.find((pt) => pt.id === replacePick.participant_id);
    return p?.team_name || '';
  }, [replacePick, participants]);

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

  if (draft.status !== 'in_progress' && draft.status !== 'complete') {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#5a6b57] text-lg mb-2">Draft has not started yet</div>
          <div className="text-[#5a6b57] text-sm">Status: {draft.status}</div>
        </div>
      </div>
    );
  }

  const totalPicks = picks.length;
  const totalSlots = managers * (draft.players_per_team || 0);

  return (
    <div className="h-screen bg-[#050a05] flex flex-col">
      <div className="shrink-0 border-b border-[#141e12] bg-[#0a0f0a] px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <h1 className="text-base md:text-lg font-bold text-[#c8d9c3]">{draft.name}</h1>
            <div className="text-xs md:text-sm text-[#5a6b57]">
              Round {currentRound} &bull; Pick {currentPick}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {isDraftComplete ? (
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-[#4a7c59] rounded-lg text-xs md:text-sm font-bold text-[#c8d9c3]">
                  DRAFT COMPLETE
                </div>
                <Link
                  href={`/draft/${draftId}/results`}
                  className="px-3 py-1.5 text-xs md:text-sm font-bold text-[#050a05] bg-[#6b9b7a] rounded-lg hover:bg-[#8ab89a] transition-colors"
                >
                  View Results
                </Link>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-[#4a7c59] rounded-lg text-xs md:text-sm font-bold text-white animate-pulse">
                ON THE CLOCK: {currentParticipant?.team_name || '...'}
              </div>
            )}
            <div className="text-xs md:text-sm text-[#5a6b57]">
              {totalPicks}/{totalSlots}
            </div>
            {isAdmin && (
              <>
                {!isDraftComplete && (
                  <button
                    onClick={handleUndo}
                    disabled={totalPicks === 0}
                    className="px-3 py-2 text-xs font-medium text-[#c8d9c3] bg-[#050a05] border border-[#141e12] rounded-lg hover:bg-[#141e12] hover:border-[#4a7c59] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Undo
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-3 py-2 text-xs font-medium text-red-400 bg-[#050a05] border border-[#3d1a1a] rounded-lg hover:bg-[#3d1a1a] transition-colors"
                >
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden flex border-b border-[#141e12]">
        <button
          onClick={() => setMobileBoardTab('board')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileBoardTab === 'board' ? 'text-[#c8d9c3] bg-[#1a2f1a] border-b-2 border-[#4a7c59]' : 'text-[#5a6b57]'
          }`}
        >
          Draft Board
        </button>
        <button
          onClick={() => setMobileBoardTab('players')}
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            mobileBoardTab === 'players' ? 'text-[#c8d9c3] bg-[#1a2f1a] border-b-2 border-[#4a7c59]' : 'text-[#5a6b57]'
          }`}
        >
          Players
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className={`flex-1 overflow-auto p-4 ${mobileBoardTab !== 'board' ? 'hidden lg:block' : ''}`}>
          <DraftBoardGrid
            participants={participants}
            picks={picks}
            players={players}
            currentRound={currentRound}
            currentPick={currentPick}
            playersPerTeam={draft.players_per_team || 10}
            currentParticipant={currentParticipant}
            onPickClick={(pick) => isAdmin && setReplacePick(pick)}
          />
        </div>

        <div className={`${mobileBoardTab !== 'players' ? 'hidden lg:flex' : 'flex'} w-full lg:w-96 shrink-0 flex-col border-t lg:border-t-0 lg:border-l border-[#141e12] bg-[#050a05]`}>
          <div className="shrink-0 flex gap-1 p-2 border-b border-[#141e12]">
            <button
              onClick={() => setSidebarTab('players')}
              className={`flex-1 px-2 py-2.5 text-xs font-semibold rounded transition-colors ${
                sidebarTab === 'players'
                  ? 'bg-[#4a7c59] text-[#c8d9c3]'
                  : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
              }`}
            >
              Players
            </button>
            <button
              onClick={() => setSidebarTab('teams')}
              className={`flex-1 px-2 py-2.5 text-xs font-semibold rounded transition-colors ${
                sidebarTab === 'teams'
                  ? 'bg-[#4a7c59] text-[#c8d9c3]'
                  : 'bg-[#0a0f0a] text-[#5a6b57] hover:bg-[#141e12]'
              }`}
            >
              Teams
            </button>
          </div>
          {sidebarTab === 'players' ? (
            <PlayerList
              availablePlayers={availablePlayers}
              onPickPlayer={handlePickPlayer}
              loading={loading}
              picking={picking}
              isDraftComplete={isDraftComplete}
              currentParticipant={currentParticipant}
              pickTimerSeconds={draft.pick_timer_seconds}
              showSearch={true}
              showHeader={true}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <TeamBrowserTab
                players={players}
                picks={picks}
                participants={participants}
                onDraftPlayer={handlePickPlayer}
                isDraftComplete={isDraftComplete}
                seasonType={draft?.season_type ?? 'playoffs'}
                playoffTeams={playoffTeams}
              />
            </div>
          )}
        </div>
      </div>

      {replacePick && isAdmin && (
        <ReplacePickModal
          pick={replacePick}
          availablePlayers={availablePlayers}
          participantName={replacePickParticipant}
          onReplace={handleReplacePick}
          onClose={() => setReplacePick(null)}
          replacing={replacing}
        />
      )}
    </div>
  );
}
