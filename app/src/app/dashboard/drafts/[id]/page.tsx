'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import InviteForm from '@/components/InviteForm';
import ParticipantList from '@/components/ParticipantList';
import DraftStartModal from '@/components/DraftStartModal';

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
  const router = useRouter();
  const { user } = useAuth();
  const draftId = params.id as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [adminTeamName, setAdminTeamName] = useState('');

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

  const handleTogglePaid = async (id: string, has_paid: boolean) => {
    const res = await fetch('/api/participants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: id, has_paid }),
    });
    if (res.ok) {
      fetchDraft();
    }
  };

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  const participantsWithAdmin = useMemo(() => {
    if (!isAdmin || !user) return participants;
    const adminInList = participants.some((p) => p.team_name === (adminTeamName || 'Commissioner'));
    if (adminInList) return participants;
    return [...participants, { id: '__admin__', team_name: adminTeamName || 'Commissioner', draft_position: null, has_paid: true, created_at: new Date().toISOString() }];
  }, [participants, isAdmin, user, adminTeamName]);

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
          <Link href="/" className="text-[#6b9b7a] hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    if (draft.status === 'in_progress' || draft.status === 'complete') {
      return (
        <div className="min-h-screen bg-[#050a05]">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <Link href="/" className="text-sm text-[#5a6b57] hover:text-[#c8d9c3]">&larr; Back to Dashboard</Link>
            <h1 className="text-3xl font-bold text-[#c8d9c3] mt-2">{draft.name}</h1>
            <div className="text-sm text-[#5a6b57] mt-1">
              {draft.status === 'in_progress' ? 'Draft In Progress' : 'Draft Complete'} &bull; {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}
            </div>
            <div className="mt-6 flex gap-3">
              <Link
                href={`/draft/${draftId}/team`}
                className="inline-block px-6 py-3 bg-[#0a0f0a] border border-[#141e12] text-[#c8d9c3] rounded-lg font-semibold hover:border-[#4a7c59] transition-colors"
              >
                {draft.status === 'in_progress' ? 'View My Team' : 'View Draft Board'}
              </Link>
              {draft.status === 'complete' && (
                <>
                  <Link
                    href={`/draft/${draftId}/results`}
                    className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
                  >
                    View Results
                  </Link>
                  <Link
                    href={`/draft/${draftId}/standings`}
                    className="inline-block px-6 py-3 bg-[#0a0f0a] border border-[#141e12] text-[#c8d9c3] rounded-lg font-semibold hover:border-[#4a7c59] transition-colors"
                  >
                    Standings
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-4">Waiting for Draft</h1>
          <Link href="/" className="text-[#6b9b7a] hover:underline">Back to Dashboard</Link>
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
            <Link href="/" className="text-sm text-[#5a6b57] hover:text-[#c8d9c3]">&larr; Back to Dashboard</Link>
            <h1 className="text-3xl font-bold text-[#c8d9c3] mt-2">{draft.name}</h1>
            <div className="text-sm text-[#5a6b57] mt-1">
              {statusLabels[draft.status] || draft.status} &bull; {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}
            </div>
          </div>
          <div className="flex gap-2">
            {(draft.status === 'setup' || draft.status === 'inviting') && participants.length > 0 && (
              <button
                onClick={() => setShowStartModal(true)}
                className="px-4 py-2 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
              >
                Start Draft
              </button>
            )}
            {draft.status === 'in_progress' && (
              <>
                <Link
                  href={`/draft/${draftId}/coach`}
                  className="px-4 py-2 text-sm font-medium text-[#5a6b57] bg-[#0a0f0a] border border-[#141e12] rounded-lg hover:border-[#4a7c59] transition-colors"
                >
                  My Team
                </Link>
                <Link
                  href={`/draft/${draftId}/live`}
                  className="px-4 py-2 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
                >
                  Go to Live Draft
                </Link>
              </>
            )}
            {draft.status === 'complete' && (
              <>
                <Link
                  href={`/draft/${draftId}/results`}
                  className="px-4 py-2 text-sm font-medium text-[#5a6b57] bg-[#0a0f0a] border border-[#141e12] rounded-lg hover:border-[#4a7c59] transition-colors"
                >
                  Draft Recap
                </Link>
                <Link
                  href={`/draft/${draftId}/standings`}
                  className="px-4 py-2 text-sm font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
                >
                  Standings
                </Link>
              </>
            )}
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
            <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6">
              <h3 className="text-sm font-semibold text-[#6b9b7a] mb-3">Your Team Name</h3>
              <input
                type="text"
                placeholder="Enter your team name..."
                value={adminTeamName}
                onChange={(e) => setAdminTeamName(e.target.value)}
                className="w-full px-4 py-2 border border-[#141e12] rounded-lg bg-[#0a0f0a] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
              />
            </div>
          )}

          {(draft.status === 'setup' || draft.status === 'inviting') && (
            <InviteForm draftId={draftId} onInviteSent={fetchDraft} />
          )}

          <ParticipantList
            participants={draft.status === 'setup' || draft.status === 'inviting' ? participantsWithAdmin : participants}
            invites={invites}
            onRemoveParticipant={handleRemoveParticipant}
            onRemoveInvite={handleRemoveInvite}
            onTogglePaid={handleTogglePaid}
          />
        </div>

        {showStartModal && (
          <DraftStartModal
            draftId={draftId}
            participants={participantsWithAdmin}
            adminTeamName={adminTeamName || 'Commissioner'}
            onStart={() => {
              setShowStartModal(false);
              router.push(`/draft/${draftId}/live`);
            }}
            onClose={() => setShowStartModal(false)}
          />
        )}
      </div>
    </div>
  );
}
