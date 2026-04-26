'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';

interface DraftDetails {
  id: string;
  name: string;
  season_type: string;
  draft_date: string | null;
  draft_time: string | null;
  location: string | null;
  entry_fee: number;
  currency: string;
  payment_method: string | null;
  payment_info: string | null;
  notes: string | null;
}

export default function JoinDraftPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const draftId = params.draftId as string;

  const [draft, setDraft] = useState<DraftDetails | null>(null);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchDraft = async () => {
      const res = await fetch(`/api/drafts/${draftId}`);
      if (res.ok) {
        const data = await res.json();
        setDraft(data.draft);
      }
      setLoading(false);
    };
    fetchDraft();
  }, [draftId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: draftId, team_name: teamName }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to register');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-2">Join Draft</h1>
          {draft && <p className="text-[#6b9b7a] mb-6">{draft.name}</p>}
          <p className="text-[#5a6b57] mb-6">Sign in or create an account to join this draft</p>
          <div className="space-y-3">
            <Link
              href={`/auth/login?next=/join/${draftId}`}
              className="block w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href={`/auth/signup?next=/join/${draftId}`}
              className="block w-full py-3 border border-[#141e12] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#141e12] transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-[#6b9b7a] mb-2">You&apos;re In!</h1>
          <p className="text-[#5a6b57] mb-6">
            Registered as <strong className="text-[#c8d9c3]">{teamName}</strong> for {draft?.name}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[#c8d9c3] mb-2">Draft Not Found</h1>
          <p className="text-[#5a6b57] mb-6">This draft may have been removed or the link is incorrect.</p>
          <Link href="/" className="text-[#6b9b7a] hover:underline">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
      <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-lg w-full">
        <h1 className="text-2xl font-bold text-[#c8d9c3] text-center mb-6">{draft.name}</h1>

        <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-[#6b9b7a] mb-3">Event Details</h3>
          <div className="space-y-2 text-sm">
            {draft.draft_date && (
              <div className="flex justify-between">
                <span className="text-[#5a6b57]">Date</span>
                <span className="text-[#c8d9c3]">{new Date(draft.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
            {draft.draft_time && (
              <div className="flex justify-between">
                <span className="text-[#5a6b57]">Time</span>
                <span className="text-[#c8d9c3]">{draft.draft_time}</span>
              </div>
            )}
            {draft.location && (
              <div className="flex justify-between">
                <span className="text-[#5a6b57]">Location</span>
                <span className="text-[#c8d9c3]">{draft.location}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#5a6b57]">Season</span>
              <span className="text-[#c8d9c3]">{draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}</span>
            </div>
          </div>
        </div>

        {draft.entry_fee > 0 && (
          <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-[#6b9b7a] mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5a6b57]">Entry Fee</span>
                <span className="text-[#c8d9c3] font-bold">${draft.entry_fee} {draft.currency}</span>
              </div>
              {draft.payment_method && (
                <div className="flex justify-between">
                  <span className="text-[#5a6b57]">Method</span>
                  <span className="text-[#c8d9c3]">{draft.payment_method}</span>
                </div>
              )}
              {draft.payment_info && (
                <div className="flex justify-between">
                  <span className="text-[#5a6b57]">Send to</span>
                  <span className="text-[#c8d9c3]">{draft.payment_info}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {draft.notes && (
          <p className="text-sm text-[#5a6b57] italic mb-6">{draft.notes}</p>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Your Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              placeholder="e.g. Jake's Destroyers"
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Registering...' : 'Join Draft'}
          </button>
        </form>
      </div>
    </div>
  );
}
