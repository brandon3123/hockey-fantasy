'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { createClient } from '@/lib/supabase/client';
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

function JoinDraftForm() {
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
  const [confirmationSent, setConfirmationSent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authLoading2, setAuthLoading] = useState(false);

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

  const handleGoogle = async () => {
    setAuthLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/join/${draftId}`)}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setAuthLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/join/${draftId}`)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setAuthLoading(false);
      return;
    }

    setError(null);
    setAuthLoading(false);

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.push(`/join/${draftId}`);
    } else {
      setConfirmationSent(true);
    }
  };

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

  if (success) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-[#6b9b7a] mb-2">You&apos;re In!</h1>
          <p className="text-[#5a6b57] mb-6">
            Registered as <strong className="text-[#c8d9c3]">{teamName}</strong> for {draft.name}
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

  if (confirmationSent) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#9993;</div>
          <h1 className="text-2xl font-bold text-[#6b9b7a] mb-2">Confirmation Email Sent</h1>
          <p className="text-[#5a6b57] mb-2">
            We sent a confirmation link to <strong className="text-[#c8d9c3]">{email}</strong>
          </p>
          <p className="text-[#5a6b57] text-sm mb-6">
            Click the link in the email to verify your account and join <strong className="text-[#c8d9c3]">{draft.name}</strong>
          </p>
          <Link
            href={`/auth/login?next=/join/${draftId}`}
            className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Sign In After Confirming
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full">
          <h1 className="text-2xl font-bold text-[#c8d9c3] text-center mb-2">You&apos;ve Been Invited!</h1>
          <p className="text-[#6b9b7a] text-center mb-1 font-semibold">{draft.name}</p>
          {draft.draft_date && (
            <p className="text-[#5a6b57] text-center text-sm mb-6">
              {new Date(draft.draft_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          <p className="text-[#5a6b57] text-center text-sm mb-6">Sign in to view details and join the draft</p>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={authLoading2}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#141e12] rounded-lg text-[#c8d9c3] hover:bg-[#141e12] transition-colors mb-4 disabled:opacity-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {authLoading2 ? 'Connecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-px bg-[#141e12]"></div>
            <span className="text-[#5a6b57] text-xs">OR</span>
            <div className="flex-1 h-px bg-[#141e12]"></div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email address"
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Password (min 6 characters)"
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Confirm password"
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
            <button
              type="submit"
              disabled={authLoading2}
              className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50"
            >
              {authLoading2 ? 'Creating account...' : 'Create Account & Continue'}
            </button>
          </form>

          {draft.entry_fee > 0 && (
            <p className="text-center text-xs text-[#5a6b57] mt-4">
              Entry fee: ${draft.entry_fee} {draft.currency}
            </p>
          )}
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

export default function JoinDraftPage() {
  return (
    <Suspense>
      <JoinDraftForm />
    </Suspense>
  );
}
