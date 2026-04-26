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
  onRemoveParticipant?: (id: string) => void;
  onRemoveInvite?: (id: string) => void;
}

export default function ParticipantList({ participants, invites, totalSlots, onRemoveParticipant, onRemoveInvite }: ParticipantListProps) {
  const pendingInvites = invites.filter((inv) => inv.status === 'pending');
  const registeredCount = participants.length;
  const totalSlotsDisplay = totalSlots || 12;

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
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-4 py-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#6b9b7a]">&#10003;</span>
              <span className="font-medium text-[#c8d9c3]">{p.team_name}</span>
            </div>
            <div className="flex items-center gap-3">
              {p.has_paid ? (
                <span className="text-xs bg-[#1a2f1a] text-[#6b9b7a] px-2 py-1 rounded">Paid</span>
              ) : (
                <span className="text-xs bg-[#3d3a1a] text-[#9b8f6b] px-2 py-1 rounded">Unpaid</span>
              )}
              {onRemoveParticipant && (
                <button
                  onClick={() => onRemoveParticipant(p.id)}
                  className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm"
                  title="Remove participant"
                >
                  &#10005;
                </button>
              )}
            </div>
          </div>
        ))}

        {pendingInvites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between px-4 py-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg opacity-60"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#888]">&#9675;</span>
              <span className="text-[#5a6b57] italic">{inv.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#5a6b57]">Pending</span>
              {onRemoveInvite && (
                <button
                  onClick={() => onRemoveInvite(inv.id)}
                  className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm"
                  title="Cancel invite"
                >
                  &#10005;
                </button>
              )}
            </div>
          </div>
        ))}

        {registeredCount === 0 && pendingInvites.length === 0 && (
          <div className="text-center text-[#5a6b57] py-6">
            No participants yet. Invite people using the form above.
          </div>
        )}
      </div>
    </div>
  );
}
