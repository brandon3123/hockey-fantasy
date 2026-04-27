'use client';

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function VerifyHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      const supabase = createClient();

      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      } else {
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (sessionError) {
              setError(sessionError.message);
              return;
            }
          }
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login?error=verification_failed');
        return;
      }

      const { data: invites } = await supabase
        .from('draft_invites')
        .select('draft_id')
        .eq('email', user.email)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false })
        .limit(1);

      if (invites && invites.length > 0) {
        router.push(`/join/${invites[0].draft_id}`);
      } else {
        router.push('/dashboard');
      }
    };

    verify();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-red-400 mb-2">Verification Failed</h1>
          <p className="text-[#5a6b57] text-sm mb-4">{error}</p>
          <a href="/auth/login" className="text-[#4a7c59] hover:underline text-sm">Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
      <div className="text-[#c8d9c3]">Verifying your invitation...</div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyHandler />
    </Suspense>
  );
}
