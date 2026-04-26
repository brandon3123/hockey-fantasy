'use client';

import { useState, useEffect } from 'react';
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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDrafts = async () => {
      const res = await fetch('/api/drafts');
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
      setLoading(false);
    };

    fetchDrafts();
  }, [user]);

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
        ) : drafts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">&#127953;</div>
            <h2 className="text-xl font-bold text-[#c8d9c3] mb-2">No drafts yet</h2>
            <p className="text-[#5a6b57] mb-6">Create your first draft to get started</p>
            <Link
              href="/dashboard/drafts/new"
              className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
            >
              Create New Draft
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {drafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/dashboard/drafts/${draft.id}`}
                className="block bg-[#0a0f0a] border border-[#141e12] rounded-lg p-6 hover:border-[#4a7c59] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#c8d9c3]">{draft.name}</h3>
                    <div className="text-sm text-[#5a6b57] mt-1">
                      {draft.draft_date && new Date(draft.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      {draft.draft_time && ` at ${draft.draft_time}`}
                      {draft.draft_date && ' \u2022 '}
                      {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${statusColors[draft.status] || 'text-[#5a6b57]'}`}>
                    {statusLabels[draft.status] || draft.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
