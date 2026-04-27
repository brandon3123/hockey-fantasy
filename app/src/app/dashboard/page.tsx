'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';

interface Draft {
  id: string;
  name: string;
  season_type: string;
  status: string;
  draft_date: string | null;
  draft_time: string | null;
  created_at: string;
}

interface JoinedDraft extends Draft {
  team_name: string;
  has_paid: boolean;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [joined, setJoined] = useState<JoinedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    const res = await fetch('/api/drafts');
    if (res.ok) {
      const data = await res.json();
      setDrafts(data.drafts || []);
      setJoined(data.joined || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDrafts();
  }, [user, fetchDrafts]);

  const handleDeleteDraft = async (e: React.MouseEvent, draftId: string, draftName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${draftName}"? This removes all invites, participants, and picks. This cannot be undone.`)) return;
    setDeleting(draftId);
    const res = await fetch('/api/drafts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: draftId }),
    });
    if (res.ok) {
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    }
    setDeleting(null);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    setup: 'text-[#5a6b57]',
    inviting: 'text-[#9b8f6b]',
    in_progress: 'text-[#6b9b7a]',
    complete: 'text-[#5a6b57]',
  };

  const statusLabels: Record<string, string> = {
    setup: 'Setup',
    inviting: 'Inviting',
    in_progress: 'In Progress',
    complete: 'Complete',
  };

  const formatDate = (d: Draft) => {
    const parts = [];
    if (d.draft_date) parts.push(new Date(d.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    if (d.draft_time) parts.push(`at ${d.draft_time}`);
    if (d.draft_date) parts.push('\u2022');
    parts.push(d.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season');
    return parts.join(' ');
  };

  const allEmpty = drafts.length === 0 && joined.length === 0;

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#c8d9c3]">My Drafts</h1>
          <Link
            href="/dashboard/drafts/new"
            className="px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Create New Draft
          </Link>
        </div>

        {loading ? (
          <div className="text-[#5a6b57]">Loading drafts...</div>
        ) : allEmpty ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">&#127953;</div>
            <h2 className="text-xl font-bold text-[#c8d9c3] mb-2">No drafts yet</h2>
            <p className="text-[#5a6b57] mb-6">Create your first draft or join one with an invite link</p>
            <Link
              href="/dashboard/drafts/new"
              className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
            >
              Create New Draft
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {drafts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#6b9b7a] mb-3">Admin</h2>
                <div className="grid gap-4">
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-6 hover:border-[#4a7c59] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <Link href={`/dashboard/drafts/${draft.id}`} className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-[#c8d9c3]">{draft.name}</h3>
                              <div className="text-sm text-[#5a6b57] mt-1">{formatDate(draft)}</div>
                            </div>
                            <span className={`text-sm font-semibold ${statusColors[draft.status] || 'text-[#5a6b57]'}`}>
                              {statusLabels[draft.status] || draft.status}
                            </span>
                          </div>
                        </Link>
                        <button
                          onClick={(e) => handleDeleteDraft(e, draft.id, draft.name)}
                          disabled={deleting === draft.id}
                          className="ml-4 text-[#5a6b57] hover:text-red-400 transition-colors text-sm disabled:opacity-50"
                          title="Delete draft"
                        >
                          {deleting === draft.id ? '...' : '\u2715'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {joined.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-[#9b8f6b] mb-3">Joined</h2>
                <div className="grid gap-4">
                  {joined.map((draft) => (
                    <div
                      key={draft.id}
                      className="bg-[#0a0f0a] border border-[#141e12] rounded-lg p-6 hover:border-[#9b8f6b] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-[#c8d9c3]">{draft.name}</h3>
                              <div className="text-sm text-[#5a6b57] mt-1">
                                {formatDate(draft)}
                                {draft.team_name && ` \u2022 Team: ${draft.team_name}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-semibold ${statusColors[draft.status] || 'text-[#5a6b57]'}`}>
                                {statusLabels[draft.status] || draft.status}
                              </span>
                              {(draft.status === 'in_progress' || draft.status === 'complete') && (
                                <Link
                                  href={`/draft/${draft.id}/team`}
                                  className="px-3 py-1.5 text-xs font-medium text-[#c8d9c3] bg-[#4a7c59] rounded-lg hover:bg-[#3d664a] transition-colors"
                                >
                                  {draft.status === 'in_progress' ? 'My Team' : 'View Board'}
                                </Link>
                              )}
                            </div>
                          </div>
                          {draft.has_paid && (
                            <div className="text-xs text-[#6b9b7a] mt-2">Paid</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
