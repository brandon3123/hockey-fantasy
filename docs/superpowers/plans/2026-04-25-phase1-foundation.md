# Phase 1: Foundation — Supabase, Auth, Database, Data Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Supabase (database + auth), create login/signup pages, and migrate player data from static JSON to Supabase while keeping existing draft functionality intact.

**Architecture:** Add Supabase as the backend. The app gains authentication (Google OAuth + email/password) and reads player data from Supabase instead of a static JSON file. Existing draft pages continue to work with localStorage for now — the multi-user draft migration happens in Phase 3.

**Tech Stack:** Next.js 15, Supabase JS SDK v2, Supabase Auth, PostgreSQL, TypeScript

---

## File Structure

### New Files
- `app/src/lib/supabase/client.ts` — Browser-side Supabase client
- `app/src/lib/supabase/server.ts` — Server-side Supabase client (for Server Components / middleware)
- `app/src/lib/supabase/middleware.ts` — Auth middleware helper
- `app/src/context/auth-context.tsx` — React context providing current user + session
- `app/src/app/auth/login/page.tsx` — Login page (email/password + Google OAuth)
- `app/src/app/auth/signup/page.tsx` — Signup page (email/password + Google OAuth)
- `app/src/app/auth/callback/route.ts` — OAuth callback handler
- `app/src/middleware.ts` — Next.js middleware for auth route protection
- `supabase/migrations/001_initial_schema.sql` — All database tables
- `scripts/import-players.ts` — One-time script to seed players table from players.json

### Modified Files
- `app/package.json` — Add @supabase/supabase-js, @supabase/ssr dependencies
- `app/.env.local` — Supabase URL and keys (new file)
- `app/src/app/layout.tsx` — Wrap app with AuthProvider
- `app/src/components/Navigation.tsx` — Show login/logout button, user info
- `app/src/app/page.tsx` — Load players from Supabase instead of static JSON
- `app/next.config.ts` — No changes needed (Supabase works client-side)

---

### Task 1: Install Supabase Dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install Supabase packages**

Run:
```bash
cd app && npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Verify installation**

Run: `cd app && node -e "require('@supabase/supabase-js'); require('@supabase/ssr'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: add supabase dependencies"
```

---

### Task 2: Create Environment Variables

**Files:**
- Create: `app/.env.local`
- Modify: `app/.env.example` (or create if missing)

- [ ] **Step 1: Create .env.local with placeholder values**

Write `app/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 2: Create .env.example for other developers**

Write `app/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Ensure .env.local is gitignored**

Verify `.gitignore` contains `.env.local`. If not, add it.

- [ ] **Step 4: Commit**

```bash
git add app/.env.example
git commit -m "chore: add env example for supabase config"
```

---

### Task 3: Create Supabase Client Utilities

**Files:**
- Create: `app/src/lib/supabase/client.ts`
- Create: `app/src/lib/supabase/server.ts`
- Create: `app/src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create browser client**

Write `app/src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Write `app/src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create middleware helper**

Write `app/src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/supabase/
git commit -m "feat: add supabase client utilities (browser, server, middleware)"
```

---

### Task 4: Create Next.js Middleware for Auth

**Files:**
- Create: `app/src/middleware.ts`

- [ ] **Step 1: Create middleware**

Write `app/src/middleware.ts`:
```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 2: Verify app still runs**

Run: `cd app && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/src/middleware.ts
git commit -m "feat: add next.js middleware for supabase auth session refresh"
```

---

### Task 5: Create Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

This task creates all tables in Supabase. Run this SQL in the Supabase Dashboard SQL Editor.

- [ ] **Step 1: Write the migration SQL**

Write `supabase/migrations/001_initial_schema.sql`:
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drafts table
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('playoffs', 'regular_season')),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'inviting', 'in_progress', 'complete')),
  draft_date DATE,
  draft_time TEXT,
  location TEXT,
  entry_fee INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  payment_method TEXT,
  payment_info TEXT,
  notes TEXT,
  players_per_team INTEGER NOT NULL DEFAULT 10,
  scoring_format TEXT NOT NULL DEFAULT '1pt_per_goal_assist',
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  current_round INTEGER DEFAULT 1,
  current_pick INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft invites
CREATE TABLE draft_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'rejected')),
  invited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft participants
CREATE TABLE draft_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_name TEXT NOT NULL,
  draft_position INTEGER,
  invite_id UUID REFERENCES draft_invites(id),
  has_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, user_id)
);

-- Draft picks
CREATE TABLE draft_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  manager_index INTEGER NOT NULL,
  participant_id UUID REFERENCES draft_participants(id) NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT NOT NULL,
  regular_season_goals INTEGER DEFAULT 0,
  regular_season_assists INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  points_per_game NUMERIC(4,2) DEFAULT 0,
  last_10_goals INTEGER,
  last_10_assists INTEGER,
  last_10_games INTEGER,
  last_20_goals INTEGER,
  last_20_assists INTEGER,
  last_20_games INTEGER,
  team_advancement_r1 NUMERIC(5,4),
  team_advancement_r2 NUMERIC(5,4),
  team_advancement_r3 NUMERIC(5,4),
  team_advancement_r4 NUMERIC(5,4),
  projected_playoff_games NUMERIC(5,2),
  projected_playoff_points NUMERIC(6,2),
  rank INTEGER,
  adp NUMERIC(5,2),
  injury_status TEXT DEFAULT 'healthy',
  injury_expected_return TEXT,
  injury_description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player scores (updated nightly by cron)
CREATE TABLE player_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id TEXT REFERENCES players(id) NOT NULL,
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  season_type TEXT NOT NULL,
  score_date DATE NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  UNIQUE(player_id, draft_id, score_date)
);

-- Row-Level Security Policies

-- Players: public read
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are publicly readable" ON players FOR SELECT USING (true);

-- Drafts: participants can view, admin can manage
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view drafts" ON drafts FOR SELECT USING (true);
CREATE POLICY "Admin can create drafts" ON drafts FOR INSERT WITH CHECK (auth.uid() = admin_user_id);
CREATE POLICY "Admin can update their drafts" ON drafts FOR UPDATE USING (auth.uid() = admin_user_id);

-- Draft invites: admin can manage for their drafts
ALTER TABLE draft_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view invites" ON draft_invites FOR SELECT USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can create invites" ON draft_invites FOR INSERT WITH CHECK (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can update invites" ON draft_invites FOR UPDATE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

-- Draft participants: users can view own, admin can view all for their drafts
ALTER TABLE draft_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view participants of their drafts" ON draft_participants FOR SELECT USING (
  user_id = auth.uid() OR
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Users can register as participants" ON draft_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can update participants" ON draft_participants FOR UPDATE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

-- Draft picks: anyone in draft can view, admin can insert/update
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view picks" ON draft_picks FOR SELECT USING (
  participant_id IN (SELECT id FROM draft_participants WHERE user_id = auth.uid()) OR
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can insert picks" ON draft_picks FOR INSERT WITH CHECK (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can update picks" ON draft_picks FOR UPDATE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can delete picks" ON draft_picks FOR DELETE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

-- Player scores: anyone in draft can view
ALTER TABLE player_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view scores" ON player_scores FOR SELECT USING (
  draft_id IN (
    SELECT dp.draft_id FROM draft_participants dp WHERE dp.user_id = auth.uid()
  ) OR
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Service role can insert scores" ON player_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update scores" ON player_scores FOR UPDATE USING (true);
```

- [ ] **Step 2: Run the migration**

Run this SQL in the Supabase Dashboard → SQL Editor → New Query → Run.
Expected: All tables created successfully with no errors.

- [ ] **Step 3: Verify tables exist**

In Supabase Dashboard → Table Editor, confirm these tables exist:
- `drafts`, `draft_invites`, `draft_participants`, `draft_picks`, `players`, `player_scores`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add initial database schema with RLS policies"
```

---

### Task 6: Configure Supabase Auth Providers

This is a manual setup task in the Supabase Dashboard.

- [ ] **Step 1: Enable Email/Password auth**

In Supabase Dashboard → Authentication → Providers:
- Ensure Email provider is enabled
- Disable "Confirm email" for now (can enable later with email templates)

- [ ] **Step 2: Enable Google OAuth**

In Supabase Dashboard → Authentication → Providers:
- Enable Google provider
- Go to Google Cloud Console → Create OAuth 2.0 Client ID
- Authorized JavaScript origins: `http://localhost:3000` (and your production URL later)
- Authorized redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- Copy Client ID and Client Secret into Supabase Google provider config

- [ ] **Step 3: Configure site URL**

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `http://localhost:3000` (development) or your production URL
- Redirect URLs: add `http://localhost:3000/auth/callback`

- [ ] **Step 4: Commit (config notes only)**

No code to commit — this is dashboard configuration. Document the setup in the project README if desired.

---

### Task 7: Create Auth Context Provider

**Files:**
- Create: `app/src/context/auth-context.tsx`

- [ ] **Step 1: Create the auth context**

Write `app/src/context/auth-context.tsx`:
```typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/context/auth-context.tsx
git commit -m "feat: add auth context provider with google oauth and email/password"
```

---

### Task 8: Wrap App with AuthProvider

**Files:**
- Modify: `app/src/app/layout.tsx`

- [ ] **Step 1: Update layout to include AuthProvider**

Replace the contents of `app/src/app/layout.tsx` with:
```typescript
import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/context/auth-context';

export const metadata: Metadata = {
  title: 'Hockey Playoff Draft Helper',
  description: 'Data-driven NHL playoff fantasy draft assistant',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navigation />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify app runs**

Run: `cd app && npm run dev`
Expected: App loads at http://localhost:3000 without errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/layout.tsx
git commit -m "feat: wrap app with auth provider"
```

---

### Task 9: Create OAuth Callback Route

**Files:**
- Create: `app/src/app/auth/callback/route.ts`

- [ ] **Step 1: Create the callback route handler**

Write `app/src/app/auth/callback/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/auth/callback/route.ts
git commit -m "feat: add oauth callback route handler"
```

---

### Task 10: Create Login Page

**Files:**
- Create: `app/src/app/auth/login/page.tsx`

- [ ] **Step 1: Create the login page**

Write `app/src/app/auth/login/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';

export default function LoginPage() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signInWithEmail(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
      <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full">
        <h1 className="text-2xl font-bold text-[#c8d9c3] text-center mb-6">
          Sign In
        </h1>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#141e12] rounded-lg text-[#c8d9c3] hover:bg-[#141e12] transition-colors mb-4"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-[#141e12]"></div>
          <span className="text-[#5a6b57] text-xs">OR</span>
          <div className="flex-1 h-px bg-[#141e12]"></div>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-[#5a6b57] mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-[#6b9b7a] hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `cd app && npm run dev`, navigate to `http://localhost:3000/auth/login`
Expected: Login page renders with Google button and email/password form

- [ ] **Step 3: Commit**

```bash
git add app/src/app/auth/login/page.tsx
git commit -m "feat: add login page with google oauth and email/password"
```

---

### Task 11: Create Signup Page

**Files:**
- Create: `app/src/app/auth/signup/page.tsx`

- [ ] **Step 1: Create the signup page**

Write `app/src/app/auth/signup/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signUpWithEmail(email, password);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
        <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-[#6b9b7a] mb-2">Account Created!</h1>
          <p className="text-[#5a6b57] mb-6">Check your email to confirm your account, then sign in.</p>
          <Link
            href="/auth/login"
            className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05] flex items-center justify-center p-4">
      <div className="bg-[#0a0f0a] p-8 rounded-lg border border-[#141e12] max-w-md w-full">
        <h1 className="text-2xl font-bold text-[#c8d9c3] text-center mb-6">
          Create Account
        </h1>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#141e12] rounded-lg text-[#c8d9c3] hover:bg-[#141e12] transition-colors mb-4"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-[#141e12]"></div>
          <span className="text-[#5a6b57] text-xs">OR</span>
          <div className="flex-1 h-px bg-[#141e12]"></div>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#5a6b57] mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-[#6b9b7a] hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `cd app && npm run dev`, navigate to `http://localhost:3000/auth/signup`
Expected: Signup page renders with Google button and email/password form

- [ ] **Step 3: Commit**

```bash
git add app/src/app/auth/signup/page.tsx
git commit -m "feat: add signup page with google oauth and email/password"
```

---

### Task 12: Update Navigation with Auth State

**Files:**
- Modify: `app/src/components/Navigation.tsx`

- [ ] **Step 1: Update Navigation to show auth state**

Replace the contents of `app/src/components/Navigation.tsx` with:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function Navigation() {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  const navItems = [
    { href: '/', label: 'Player Rankings' },
    { href: '/draft', label: 'Draft Board' },
    { href: '/rosters', label: 'Team Rosters' },
    { href: '/bracket', label: 'Playoff Bracket' },
  ];

  return (
    <nav className="bg-[#0a0f0a] border-b border-[#141e12]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#127953;</span>
            <span className="font-bold text-xl text-[#c8d9c3]">
              Hockey Draft
            </span>
          </div>
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                    isActive
                      ? 'bg-[#4a7c59] text-[#c8d9c3]'
                      : 'text-[#5a6b57] hover:bg-[#141e12]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-4 pl-4 border-l border-[#141e12]">
              {loading ? (
                <span className="text-sm text-[#5a6b57]">Loading...</span>
              ) : user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#c8d9c3]">
                    {user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="px-3 py-1 text-sm text-[#5a6b57] hover:text-[#c8d9c3] transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-md hover:bg-[#3d664a] transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify navigation renders with Sign In button**

Run: `cd app && npm run dev`, navigate to `http://localhost:3000`
Expected: Nav bar shows "Sign In" button on the right side

- [ ] **Step 3: Test auth flow end-to-end**

1. Click "Sign In" -> login page loads
2. Click "Sign Up" link -> signup page loads
3. Create account with email/password -> success message appears
4. Go back to login -> sign in -> nav shows email + "Sign Out" button

- [ ] **Step 4: Commit**

```bash
git add app/src/components/Navigation.tsx
git commit -m "feat: update navigation with auth state (login/logout/user email)"
```

---

### Task 13: Create Player Import Script

**Files:**
- Create: `scripts/import-players.ts`

This script reads `app/public/players.json` and upserts all players into the Supabase `players` table.

- [ ] **Step 1: Install tsx for running TypeScript scripts**

Run: `cd app && npm install -D tsx`

- [ ] **Step 2: Create the import script**

Write `scripts/import-players.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PlayerJSON {
  name: string;
  team: string;
  position: string;
  regularSeasonGoals: number;
  regularSeasonAssists: number;
  gamesPlayed: number;
  pointsPerGame: number;
  last10Games?: { goals: number; assists: number; games: number };
  last20Games?: { goals: number; assists: number; games: number };
  teamAdvancementOdds: { round1: number; round2: number; round3: number; round4: number };
  projectedPlayoffGames: number;
  projectedPlayoffPoints: number;
  rank: number;
  adp?: number;
  injury: {
    status: string;
    expectedReturn: string | null;
    description: string | null;
  };
}

async function importPlayers() {
  const filePath = join(__dirname, '..', 'app', 'public', 'players.json');
  const raw = readFileSync(filePath, 'utf-8');
  const players: PlayerJSON[] = JSON.parse(raw);

  console.log(`Found ${players.length} players to import`);

  const rows = players.map((p) => ({
    id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: p.name,
    team: p.team,
    position: p.position,
    regular_season_goals: p.regularSeasonGoals,
    regular_season_assists: p.regularSeasonAssists,
    games_played: p.gamesPlayed,
    points_per_game: p.pointsPerGame,
    last_10_goals: p.last10Games?.goals ?? null,
    last_10_assists: p.last10Games?.assists ?? null,
    last_10_games: p.last10Games?.games ?? null,
    last_20_goals: p.last20Games?.goals ?? null,
    last_20_assists: p.last20Games?.assists ?? null,
    last_20_games: p.last20Games?.games ?? null,
    team_advancement_r1: p.teamAdvancementOdds.round1,
    team_advancement_r2: p.teamAdvancementOdds.round2,
    team_advancement_r3: p.teamAdvancementOdds.round3,
    team_advancement_r4: p.teamAdvancementOdds.round4,
    projected_playoff_games: p.projectedPlayoffGames,
    projected_playoff_points: p.projectedPlayoffPoints,
    rank: p.rank,
    adp: p.adp ?? null,
    injury_status: p.injury.status,
    injury_expected_return: p.injury.expectedReturn,
    injury_description: p.injury.description,
    updated_at: new Date().toISOString(),
  }));

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('players').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error importing batch ${i}:`, error);
      process.exit(1);
    }
    console.log(`Imported ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }

  console.log('Import complete!');
}

importPlayers();
```

- [ ] **Step 3: Run the import script**

First set environment variables (from your Supabase dashboard):
```bash
cd /Users/brandon.nolan/development/hockey-fantasy
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
npx tsx scripts/import-players.ts
```
Expected: `Import complete!` with count of players imported

- [ ] **Step 4: Verify players in database**

In Supabase Dashboard → Table Editor → `players` table:
Expected: All players from players.json are present with correct data

- [ ] **Step 5: Commit**

```bash
git add scripts/import-players.ts
git commit -m "feat: add player import script for supabase seeding"
```

---

### Task 14: Migrate Home Page to Load Players from Supabase

**Files:**
- Modify: `app/src/app/page.tsx`

- [ ] **Step 1: Update home page to fetch from Supabase**

Replace the contents of `app/src/app/page.tsx` with:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types/player';
import PlayerTable from '@/components/PlayerTable';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface PlayerRow {
  id: string;
  name: string;
  team: string;
  position: string;
  regular_season_goals: number;
  regular_season_assists: number;
  games_played: number;
  points_per_game: number;
  last_10_goals: number | null;
  last_10_assists: number | null;
  last_10_games: number | null;
  last_20_goals: number | null;
  last_20_assists: number | null;
  last_20_games: number | null;
  team_advancement_r1: number;
  team_advancement_r2: number;
  team_advancement_r3: number;
  team_advancement_r4: number;
  projected_playoff_games: number;
  projected_playoff_points: number;
  rank: number;
  adp: number | null;
  injury_status: string;
  injury_expected_return: string | null;
  injury_description: string | null;
}

function mapRowToPlayer(row: PlayerRow): Player {
  return {
    name: row.name,
    team: row.team,
    position: row.position as Player['position'],
    regularSeasonGoals: row.regular_season_goals,
    regularSeasonAssists: row.regular_season_assists,
    gamesPlayed: row.games_played,
    pointsPerGame: row.points_per_game,
    last10Games: row.last_10_games != null
      ? { goals: row.last_10_goals!, assists: row.last_10_assists!, points: row.last_10_goals! + row.last_10_assists!, games: row.last_10_games }
      : undefined,
    last20Games: row.last_20_games != null
      ? { goals: row.last_20_goals!, assists: row.last_20_assists!, points: row.last_20_goals! + row.last_20_assists!, games: row.last_20_games }
      : undefined,
    teamAdvancementOdds: {
      round1: row.team_advancement_r1,
      round2: row.team_advancement_r2,
      round3: row.team_advancement_r3,
      round4: row.team_advancement_r4,
    },
    projectedPlayoffGames: row.projected_playoff_games,
    projectedPlayoffPoints: row.projected_playoff_points,
    rank: row.rank,
    adp: row.adp ?? undefined,
    injury: {
      status: row.injury_status as Player['injury']['status'],
      expectedReturn: row.injury_expected_return,
      description: row.injury_description,
    },
  };
}

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadPlayers = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('projected_playoff_points', { ascending: false });

      if (error) {
        console.error('Failed to load players from Supabase:', error);
        // Fallback to static JSON
        try {
          const res = await fetch('/players.json');
          const fallbackData = await res.json();
          setPlayers(fallbackData);
        } catch (e) {
          console.error('Fallback also failed:', e);
        }
      } else if (data) {
        setPlayers(data.map(mapRowToPlayer));
      }
      setLoading(false);
    };

    loadPlayers();

    const saved = localStorage.getItem('watchlist');
    if (saved) {
      setWatchlist(new Set(JSON.parse(saved)));
    }
  }, []);

  const handleToggleWatchlist = (playerName: string) => {
    const newWatchlist = new Set(watchlist);
    if (newWatchlist.has(playerName)) {
      newWatchlist.delete(playerName);
    } else {
      newWatchlist.add(playerName);
    }
    setWatchlist(newWatchlist);
    localStorage.setItem('watchlist', JSON.stringify([...newWatchlist]));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading player data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05]">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#c8d9c3] mb-4">
            Hockey Fantasy Pool
          </h1>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#c8d9c3] mb-2">
            Player Rankings
          </h2>
          <p className="text-[#5a6b57]">
            Players ranked by projected playoff points. Sort, filter, and build your watchlist.
          </p>
        </div>

        <PlayerTable
          players={players}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />

        <div className="mt-8 text-center">
          <Link
            href="/draft"
            className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Start Draft &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify home page loads from Supabase**

Run: `cd app && npm run dev`, navigate to `http://localhost:3000`
Expected: Player rankings table loads with data from Supabase. If Supabase is unreachable, falls back to static JSON.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/page.tsx
git commit -m "feat: load player rankings from supabase with json fallback"
```

---

### Task 15: End-to-End Verification

This is a manual verification task to confirm the entire Phase 1 works.

- [ ] **Step 1: Verify full build**

Run: `cd app && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Verify auth flow**

1. Navigate to `http://localhost:3000`
2. Click "Sign In" in nav -> login page loads
3. Click "Sign Up" -> signup page loads
4. Sign up with email/password -> success message
5. Go back to login -> sign in -> nav shows email + "Sign Out"
6. Click "Sign Out" -> nav shows "Sign In" again

- [ ] **Step 3: Verify Google OAuth**

1. Click "Sign In" -> click "Continue with Google"
2. Google sign-in flow completes
3. Redirected back to app, nav shows email + "Sign Out"

- [ ] **Step 4: Verify player data loads**

1. Navigate to home page
2. Player rankings table loads with data
3. Sorting, filtering, watchlist all work as before

- [ ] **Step 5: Verify existing draft still works**

1. Navigate to Draft Board
2. Draft setup form works (localStorage-based, unchanged)
3. Draft grid, coach, best available all work as before

- [ ] **Step 6: Run lint**

Run: `cd app && npm run lint`
Expected: No lint errors
