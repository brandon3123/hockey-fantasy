'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function CompleteSignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextUrl = searchParams.get('next') || '/';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSetPassword = async (e: React.FormEvent) => {
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

    setLoading(true);

    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Failed to set password');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      router.push(nextUrl);
    }, 1500);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });
    if (linkError) {
      setError(linkError.message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-[#6b9b7a] mb-2">Account Ready!</h1>
          <p className="text-[#5a6b57]">Redirecting you to the draft...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
      <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full">
        <h1 className="text-2xl font-bold text-[#c8d9c3] text-center mb-2">Complete Your Account</h1>
        <p className="text-[#5a6b57] text-center text-sm mb-6">Choose how you&apos;ll log in on draft night</p>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#141e12] rounded-lg text-[#c8d9c3] hover:bg-[#141e12] transition-colors mb-4 disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Connecting...' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-[#141e12]"></div>
          <span className="text-[#5a6b57] text-xs">OR</span>
          <div className="flex-1 h-px bg-[#141e12]"></div>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Re-enter your password"
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting password...' : 'Set Password & Continue'}
          </button>
        </form>

        <p className="text-center text-xs text-[#5a6b57] mt-4">
          You&apos;ll use this to log in on draft night.
        </p>
      </div>
    </div>
  );
}

export default function CompleteSignupPage() {
  return (
    <Suspense>
      <CompleteSignupForm />
    </Suspense>
  );
}
