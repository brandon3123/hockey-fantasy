'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import InviteForm from '@/components/InviteForm';
import ParticipantList from '@/components/ParticipantList';

interface Draft {
  id: string;
  name: string;
  season_type: string;
  status: string;
  draft_date: string | null;
  draft_time: string | null;
  location: string | null;
  entry_fee: number;
  currency: string;
  payment_method: string | null;
  payment_info: string | null;
  notes: string | null;
  players_per_team: number;
  scoring_format: string;
}

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

export default function DraftDetailPage() {
  const params = useParams();
  const draftId = params.id as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/drafts/${draftId}`);
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
      setParticipants(data.participants || []);
      setInvites(data.invites || []);
      setIsAdmin(data.is_admin);
    }
    setLoading(false);
  }, [draftId]);

  const handleRemoveParticipant = async (id: string) => {
    const res = await fetch('/api/participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: id }),
    });
    if (res.ok) {
      fetchDraft();
    }
  };

  const handleRemoveInvite = async (id: string) => {
    const res = await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: id }),
    });
    if (res.ok) {
      fetchDraft();
    }
  };

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-4">Draft Not Found</h1>
          <Link href="/dashboard" className="text-[#6b9b7a] hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-4">Not Your Draft</h1>
          <Link href="/dashboard" className="text-[#6b9b7a] hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    setup: 'Setup',
    inviting: 'Inviting Participants',
    in_progress: 'Draft In Progress',
    complete: 'Draft Complete',
  };

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/dashboard" className="text-sm text-[#5a6b57] hover:text-[#c8d9c3]">&larr; Back to Dashboard</Link>
            <h1 className="text-3xl font-bold text-[#c8d9c3] mt-2">{draft.name}</h1>
            <div className="text-sm text-[#5a6b57] mt-1">
              {statusLabels[draft.status] || draft.status} &bull; {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}
            </div>
          </div>
        </div>

        <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6 mb-6">
          <h3 className="text-sm font-semibold text-[#6b9b7a] mb-3">Event Details</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            {draft.draft_date && (
              <>
                <span className="text-[#5a6b57]">Date</span>
                <span className="text-[#c8d9c3]">{new Date(draft.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </>
            )}
            {draft.draft_time && (
              <>
                <span className="text-[#5a6b57]">Time</span>
                <span className="text-[#c8d9c3]">{draft.draft_time}</span>
              </>
            )}
            {draft.location && (
              <>
                <span className="text-[#5a6b57]">Location</span>
                <span className="text-[#c8d9c3]">{draft.location}</span>
              </>
            )}
            <span className="text-[#5a6b57]">Players Per Team</span>
            <span className="text-[#c8d9c3]">{draft.players_per_team}</span>
            {draft.entry_fee > 0 && (
              <>
                <span className="text-[#5a6b57]">Entry Fee</span>
                <span className="text-[#c8d9c3]">${draft.entry_fee} {draft.currency}</span>
              </>
            )}
          </div>
          {draft.notes && (
            <p className="text-sm text-[#5a6b57] italic mt-3 pt-3 border-t border-[#141e12]">{draft.notes}</p>
          )}
        </div>

        <div className="space-y-6">
          {(draft.status === 'setup' || draft.status === 'inviting') && (
            <InviteForm draftId={draftId} onInviteSent={fetchDraft} />
          )}

          <ParticipantList
            participants={participants}
            invites={invites}
            onRemoveParticipant={handleRemoveParticipant}
            onRemoveInvite={handleRemoveInvite}
          />
        </div>
      </div>
    </div>
  );
}
