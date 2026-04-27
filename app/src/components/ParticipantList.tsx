'use client';

import { useState } from 'react';

interface Participant {
  id: string;
  team_name: string;
  draft_position: number | null;
  has_paid: boolean;
  created_at: string;
}

interface Invite {
  id: string;
  email: string;
  status: string;
  invited_at: string;
}

interface ParticipantListProps {
  participants: Participant[];
  invites: Invite[];
  totalSlots?: number;
  onRemoveParticipant?: (id: string) => Promise<void>;
  onRemoveInvite?: (id: string) => Promise<void>;
  onTogglePaid?: (id: string, has_paid: boolean) => Promise<void>;
}

export default function ParticipantList({ participants, invites, totalSlots, onRemoveParticipant, onRemoveInvite, onTogglePaid }: ParticipantListProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const pendingInvites = invites.filter((inv) => inv.status === 'pending');
  const registeredCount = participants.length;
  const totalSlotsDisplay = totalSlots || 12;

  const handleTogglePaid = async (id: string, has_paid: boolean) => {
    setLoadingAction(`paid-${id}`);
    await onTogglePaid?.(id, has_paid);
    setLoadingAction(null);
  };

  const handleRemoveParticipant = async (id: string) => {
    setLoadingAction(`remove-p-${id}`);
    await onRemoveParticipant?.(id);
    setLoadingAction(null);
  };

  const handleRemoveInvite = async (id: string) => {
    setLoadingAction(`remove-i-${id}`);
    await onRemoveInvite?.(id);
    setLoadingAction(null);
  };

  return (
    <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#c8d9c3]">Participants</h3>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-[#6b9b7a] font-bold">{registeredCount}</span>
            <span className="text-[#5a6b57]"> / {totalSlotsDisplay} registered</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {participants.map((p) => {
          const isLoading = loadingAction === `paid-${p.id}` || loadingAction === `remove-p-${p.id}`;
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg transition-opacity ${isLoading ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[#6b9b7a]">&#10003;</span>
                <span className="font-medium text-[#c8d9c3]">{p.team_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTogglePaid(p.id, !p.has_paid)}
                  disabled={isLoading}
                  className={`text-xs px-2 py-1 rounded transition-colors disabled:cursor-wait ${
                    p.has_paid
                      ? 'bg-[#1a2f1a] text-[#6b9b7a] hover:bg-[#2a3f2a]'
                      : 'bg-[#3d3a1a] text-[#9b8f6b] hover:bg-[#4d4a2a]'
                  }`}
                  title={p.has_paid ? 'Click to mark as unpaid' : 'Click to mark as paid'}
                >
                  {loadingAction === `paid-${p.id}` ? '...' : p.has_paid ? 'Paid' : 'Unpaid'}
                </button>
                {onRemoveParticipant && (
                  <button
                    onClick={() => handleRemoveParticipant(p.id)}
                    disabled={isLoading}
                    className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm disabled:cursor-wait disabled:opacity-50"
                    title="Remove participant"
                  >
                    {loadingAction === `remove-p-${p.id}` ? '...' : '\u2715'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {pendingInvites.map((inv) => {
          const isLoading = loadingAction === `remove-i-${inv.id}`;
          return (
            <div
              key={inv.id}
              className={`flex items-center justify-between px-4 py-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg opacity-60 transition-opacity ${isLoading ? 'opacity-30' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[#888]">&#9675;</span>
                <span className="text-[#5a6b57] italic">{inv.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#5a6b57]">Pending</span>
                {onRemoveInvite && (
                  <button
                    onClick={() => handleRemoveInvite(inv.id)}
                    disabled={isLoading}
                    className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm disabled:cursor-wait disabled:opacity-50"
                    title="Cancel invite"
                  >
                    {loadingAction === `remove-i-${inv.id}` ? '...' : '\u2715'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {registeredCount === 0 && pendingInvites.length === 0 && (
          <div className="text-center text-[#5a6b57] py-6">
            No participants yet. Invite people using the form above.
          </div>
        )}
      </div>
    </div>
  );
}
