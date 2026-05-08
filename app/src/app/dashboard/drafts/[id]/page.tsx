'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import InviteForm from '@/components/InviteForm';
import ParticipantList from '@/components/ParticipantList';
import DraftSetupForm from '@/components/DraftSetupForm';
import { ActionButton } from '@/components/ActionButton';
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

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-4">
      <div className="h-px flex-1 bg-[#1a2f1a]" />
      <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">{label}</h2>
      <div className="h-px flex-1 bg-[#1a2f1a]" />
    </div>
  );
}

export default function DraftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const draftId = params.id as string;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const { isAdmin } = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [adminTeamName, setAdminTeamName] = useState('');

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/drafts/${draftId}`);
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
      setParticipants(data.participants || []);
      setInvites(data.invites || []);
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

  const handleResendInvite = async (id: string) => {
    await fetch('/api/invites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: id }),
    });
  };

  const handleUpdateDraft = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/drafts/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      return { error: result.error || 'Failed to update draft' };
    }
    setEditingConfig(false);
    fetchDraft();
    return { draft: result.draft };
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
        <div className="text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold text-[#c8d9c3] mb-2">Draft Not Found</div>
          <div className="text-sm text-[#5a6b57]">This draft may have been deleted</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    if (draft.status === 'in_progress' || draft.status === 'complete') {
      return (
        <div className="min-h-screen bg-[#050a05]">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3] mb-2">{draft.name}</h1>
              <div className="text-sm text-[#5a6b57]">
                {draft.status === 'in_progress' ? 'Draft In Progress' : 'Draft Complete'} &bull; {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Link
                href={`/draft/${draftId}/team`}
                className="px-5 py-2.5 text-sm font-medium border border-[#4a7c59] text-[#6b9b7a] rounded-lg hover:bg-[#0a0f0a] transition-colors"
              >
                {draft.status === 'in_progress' ? 'View My Team' : 'View Draft Board'}
              </Link>
              {draft.status === 'complete' && (
                <>
                  <Link
                    href={`/draft/${draftId}/results`}
                    className="px-5 py-2.5 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors"
                  >
                    View Results
                  </Link>
                  <Link
                    href={`/draft/${draftId}/standings`}
                    className="px-5 py-2.5 text-sm font-medium border border-[#4a7c59] text-[#6b9b7a] rounded-lg hover:bg-[#0a0f0a] transition-colors"
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
          <div className="text-xl font-bold text-[#c8d9c3] mb-2">Waiting for Draft</div>
          <div className="text-sm text-[#5a6b57]">The admin hasn&apos;t started the draft yet</div>
        </div>
      </div>
    );
  }

  const statusBadge: Record<string, { label: string; color: string }> = {
    setup: { label: 'Setup', color: 'text-[#5a6b57]' },
    inviting: { label: 'Inviting', color: 'text-[#9b8f6b]' },
    in_progress: { label: 'In Progress', color: 'text-[#6b9b7a]' },
    complete: { label: 'Complete', color: 'text-[#5a6b57]' },
  };
  const badge = statusBadge[draft.status] || { label: draft.status, color: 'text-[#5a6b57]' };

  const isPreDraft = draft.status === 'setup' || draft.status === 'inviting';

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-3xl mx-auto px-4 py-8">

        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-[#5a6b57] mb-1">Draft Configuration</div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3] mb-2">{draft.name}</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-[#5a6b57]">
            <span className={badge.color}>{badge.label}</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{draft.players_per_team} Rounds</span>
          </div>
          {isPreDraft && participants.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowStartModal(true)}
                className="px-5 py-2.5 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors"
              >
                Start Draft
              </button>
            </div>
          )}
          {draft.status === 'in_progress' && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href={`/draft/${draftId}/coach`}
                className="px-5 py-2.5 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors"
              >
                Live Draft
              </Link>
              <Link
                href={`/draft/${draftId}/team`}
                className="px-5 py-2.5 text-sm font-medium border border-[#4a7c59] text-[#6b9b7a] rounded-lg hover:bg-[#0a0f0a] transition-colors"
              >
                My Team
              </Link>
            </div>
          )}
          {draft.status === 'complete' && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href={`/draft/${draftId}/standings`}
                className="px-5 py-2.5 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors"
              >
                Standings
              </Link>
              <Link
                href={`/draft/${draftId}/results`}
                className="px-5 py-2.5 text-sm font-medium border border-[#4a7c59] text-[#6b9b7a] rounded-lg hover:bg-[#0a0f0a] transition-colors"
              >
                Draft Recap
              </Link>
            </div>
          )}
        </div>

        {editingConfig ? (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Edit Draft Config</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            <DraftSetupForm
              initialData={{
                name: draft.name ?? undefined,
                season_type: draft.season_type ?? undefined,
                draft_date: draft.draft_date ?? undefined,
                draft_time: draft.draft_time ?? undefined,
                location: draft.location ?? undefined,
                entry_fee: draft.entry_fee,
                currency: draft.currency ?? undefined,
                payment_method: draft.payment_method ?? undefined,
                payment_info: draft.payment_info ?? undefined,
                notes: draft.notes ?? undefined,
                players_per_team: draft.players_per_team,
                scoring_format: draft.scoring_format ?? undefined,
              }}
              onSubmit={handleUpdateDraft}
              submitLabel="Save Changes"
              isEditing
            />
            <button
              onClick={() => setEditingConfig(false)}
              className="w-full py-2 mt-2 text-sm text-[#5a6b57] hover:text-[#c8d9c3] transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <SectionDivider label="Event Details" />
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl p-5">
              <div className="grid grid-cols-2 gap-y-3 text-sm">
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
                <span className="text-[#5a6b57]">Scoring</span>
                <span className="text-[#c8d9c3]">{draft.scoring_format === '2pt_goals_1pt_assists' ? '2pt Goals / 1pt Assists' : '1pt per Goal & Assist'}</span>
                {draft.entry_fee > 0 && (
                  <>
                    <span className="text-[#5a6b57]">Entry Fee</span>
                    <span className="text-[#c8d9c3]">{draft.currency}${draft.entry_fee}</span>
                  </>
                )}
                {draft.payment_info && (
                  <>
                    <span className="text-[#5a6b57]">Payment</span>
                    <span className="text-[#c8d9c3]">{draft.payment_method} &middot; {draft.payment_info}</span>
                  </>
                )}
              </div>
              {draft.notes && (
                <p className="text-sm text-[#5a6b57] italic mt-4 pt-4 border-t border-[#1a2f1a]">{draft.notes}</p>
              )}
              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-[#1a2f1a]">
                  <ActionButton onClick={() => setEditingConfig(true)} variant="primary" className="px-4 py-2 text-sm font-semibold">
                    Edit Config
                  </ActionButton>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {isPreDraft && (
            <div>
              <SectionDivider label="Your Team Name" />
              <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl p-5">
                <input
                  type="text"
                  placeholder="Enter your team name..."
                  value={adminTeamName}
                  onChange={(e) => setAdminTeamName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#1a2f1a] rounded-lg bg-[#050a05] text-[#c8d9c3] placeholder-[#2d3c28] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
                />
              </div>
            </div>
          )}

          {isPreDraft && (
            <div>
              <SectionDivider label="Invite Participants" />
              <InviteForm draftId={draftId} onInviteSent={fetchDraft} />
            </div>
          )}

          <div>
            <SectionDivider label="Participants" />
            <ParticipantList
              participants={isPreDraft ? participantsWithAdmin : participants}
              invites={invites}
              onRemoveParticipant={handleRemoveParticipant}
              onRemoveInvite={handleRemoveInvite}
              onResendInvite={handleResendInvite}
              onTogglePaid={handleTogglePaid}
            />
          </div>
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
