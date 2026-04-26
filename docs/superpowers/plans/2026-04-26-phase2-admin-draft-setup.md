# Phase 2: Admin Draft Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin dashboard for creating drafts, inviting participants by email, and managing registrations — the full pre-draft workflow.

**Architecture:** Admin pages live under `/dashboard/` routes, protected by auth + admin role check. API routes under `/api/` handle all Supabase writes using the server client. Participants join via `/join/[draftId]` after receiving a Supabase invite email.

**Tech Stack:** Next.js 15 App Router, Supabase (server client for API routes, browser client for queries), TypeScript

---

## File Structure

### New Files
- `app/src/app/dashboard/page.tsx` — Admin dashboard listing their drafts
- `app/src/app/dashboard/drafts/new/page.tsx` — Create new draft form
- `app/src/app/dashboard/drafts/[id]/page.tsx` — Draft detail with participant management
- `app/src/app/join/[draftId]/page.tsx` — Participant registration page (enter team name)
- `app/src/app/api/drafts/route.ts` — POST create draft, GET list my drafts
- `app/src/app/api/invites/route.ts` — POST send invites for a draft
- `app/src/app/api/participants/route.ts` — POST register as participant
- `app/src/components/DraftSetupForm.tsx` — Reusable form for draft settings
- `app/src/components/ParticipantList.tsx` — Registered/pending participant list
- `app/src/components/InviteForm.tsx` — Add email(s) to invite

### Modified Files
- `app/src/components/Navigation.tsx` — Add "Dashboard" link for authenticated users

---

### Task 1: Update Navigation with Dashboard Link

**Files:**
- Modify: `app/src/components/Navigation.tsx`

- [ ] **Step 1: Add Dashboard nav item and conditionally show based on auth**

The current Navigation component already imports `useAuth`. Add a "Dashboard" nav item that only shows when the user is logged in. Add it as the first item in the navItems array, and change the auth section so logged-in users see a "Dashboard" link.

In `app/src/components/Navigation.tsx`, update the `navItems` definition to be conditional:

Find the `navItems` const and replace it with:

```typescript
  const navItems = user
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/', label: 'Player Rankings' },
        { href: '/draft', label: 'Draft Board' },
        { href: '/rosters', label: 'Team Rosters' },
        { href: '/bracket', label: 'Playoff Bracket' },
      ]
    : [
        { href: '/', label: 'Player Rankings' },
        { href: '/draft', label: 'Draft Board' },
        { href: '/rosters', label: 'Team Rosters' },
        { href: '/bracket', label: 'Playoff Bracket' },
      ];
```

- [ ] **Step 2: Verify nav renders**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/Navigation.tsx
git commit -m "feat: add dashboard link to navigation for authenticated users"
```

---

### Task 2: Create API Route — Create/List Drafts

**Files:**
- Create: `app/src/app/api/drafts/route.ts`

First: `mkdir -p app/src/app/api/drafts`

- [ ] **Step 1: Create the drafts API route**

Write `app/src/app/api/drafts/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('admin_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    season_type,
    draft_date,
    draft_time,
    location,
    entry_fee,
    currency,
    payment_method,
    payment_info,
    notes,
    players_per_team,
    scoring_format,
  } = body;

  const { data, error } = await supabase
    .from('drafts')
    .insert({
      name,
      season_type,
      draft_date,
      draft_time,
      location,
      entry_fee,
      currency,
      payment_method,
      payment_info,
      notes,
      players_per_team,
      scoring_format,
      admin_user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: data }, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/drafts/route.ts
git commit -m "feat: add drafts API route (create + list)"
```

---

### Task 3: Create DraftSetupForm Component

**Files:**
- Create: `app/src/components/DraftSetupForm.tsx`

- [ ] **Step 1: Create the reusable draft setup form**

Write `app/src/components/DraftSetupForm.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DraftSetupFormProps {
  initialData?: {
    name?: string;
    season_type?: string;
    draft_date?: string;
    draft_time?: string;
    location?: string;
    entry_fee?: number;
    currency?: string;
    payment_method?: string;
    payment_info?: string;
    notes?: string;
    players_per_team?: number;
    scoring_format?: string;
  };
  onSubmit: (data: Record<string, unknown>) => Promise<{ error?: string; draft?: Record<string, unknown> }>;
  submitLabel?: string;
}

export default function DraftSetupForm({ initialData, onSubmit, submitLabel = 'Create Draft' }: DraftSetupFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name ?? '');
  const [seasonType, setSeasonType] = useState(initialData?.season_type ?? 'playoffs');
  const [draftDate, setDraftDate] = useState(initialData?.draft_date ?? '');
  const [draftTime, setDraftTime] = useState(initialData?.draft_time ?? '');
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [entryFee, setEntryFee] = useState(initialData?.entry_fee ?? 0);
  const [currency, setCurrency] = useState(initialData?.currency ?? 'CAD');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.payment_method ?? 'e-transfer');
  const [paymentInfo, setPaymentInfo] = useState(initialData?.payment_info ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [playersPerTeam, setPlayersPerTeam] = useState(initialData?.players_per_team ?? 10);
  const [scoringFormat, setScoringFormat] = useState(initialData?.scoring_format ?? '1pt_per_goal_assist');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await onSubmit({
      name,
      season_type: seasonType,
      draft_date: draftDate || null,
      draft_time: draftTime || null,
      location: location || null,
      entry_fee: entryFee,
      currency,
      payment_method: paymentMethod,
      payment_info: paymentInfo || null,
      notes: notes || null,
      players_per_team: playersPerTeam,
      scoring_format: scoringFormat,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.draft?.id) {
      router.push(`/dashboard/drafts/${result.draft.id}`);
    }

    setLoading(false);
  };

  const inputClass = 'w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]';
  const labelClass = 'block text-sm font-medium mb-1 text-[#c8d9c3]';
  const selectClass = 'w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59]';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#6b9b7a] mb-4">Draft Details</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Draft Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Stanley Cup Playoff Draft 2026" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Season Type</label>
              <select value={seasonType} onChange={(e) => setSeasonType(e.target.value)} className={selectClass}>
                <option value="playoffs">Playoffs</option>
                <option value="regular_season">Regular Season</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Scoring Format</label>
              <select value={scoringFormat} onChange={(e) => setScoringFormat(e.target.value)} className={selectClass}>
                <option value="1pt_per_goal_assist">1 pt per Goal/Assist</option>
                <option value="2pt_goals_1pt_assists">2 pts Goals, 1 pt Assists</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Brandon's House - 123 Main St" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Players Per Team</label>
            <input type="number" value={playersPerTeam} onChange={(e) => setPlayersPerTeam(parseInt(e.target.value, 10))} min={3} max={30} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6">
        <h3 className="text-lg font-bold text-[#6b9b7a] mb-4">Payment Details</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Entry Fee</label>
              <input type="number" value={entryFee} onChange={(e) => setEntryFee(parseInt(e.target.value, 10))} min={0} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={selectClass}>
                <option value="e-transfer">E-Transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Payment Email / Instructions</label>
            <input type="text" value={paymentInfo} onChange={(e) => setPaymentInfo(e.target.value)} placeholder="e.g. brandon@email.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Please send payment by April 25th. Pizza provided!" className={inputClass} />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DraftSetupForm.tsx
git commit -m "feat: add reusable draft setup form component"
```

---

### Task 4: Create "New Draft" Page

**Files:**
- Create: `app/src/app/dashboard/drafts/new/page.tsx`

First: `mkdir -p app/src/app/dashboard/drafts/new`

- [ ] **Step 1: Create the new draft page**

Write `app/src/app/dashboard/drafts/new/page.tsx`:

```typescript
'use client';

import DraftSetupForm from '@/components/DraftSetupForm';

export default function NewDraftPage() {
  const handleCreate = async (data: Record<string, unknown>) => {
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      return { error: result.error || 'Failed to create draft' };
    }

    return { draft: result.draft };
  };

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[#c8d9c3] mb-6">Create New Draft</h1>
        <DraftSetupForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/dashboard/drafts/new/page.tsx
git commit -m "feat: add new draft creation page"
```

---

### Task 5: Create Admin Dashboard Page

**Files:**
- Create: `app/src/app/dashboard/page.tsx`

First: `mkdir -p app/src/app/dashboard`

- [ ] **Step 1: Create the admin dashboard**

Write `app/src/app/dashboard/page.tsx`:

```typescript
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
                      {draft.draft_date && ' • '}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/dashboard/page.tsx
git commit -m "feat: add admin dashboard with draft listing"
```

---

### Task 6: Create Invites API Route

**Files:**
- Create: `app/src/app/api/invites/route.ts`

First: `mkdir -p app/src/app/api/invites`

- [ ] **Step 1: Create the invites API route**

This route accepts a draft_id and array of emails. For each email it creates a draft_invite record and sends a Supabase invite email. If the user already exists, we skip the invite email (they can use the shareable link instead).

Write `app/src/app/api/invites/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { draft_id, emails } = await request.json();

  if (!draft_id || !emails || !Array.isArray(emails)) {
    return NextResponse.json({ error: 'draft_id and emails array required' }, { status: 400 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  const results = [];

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) continue;

    const { data: invite, error } = await supabase
      .from('draft_invites')
      .insert({ draft_id, email: trimmed })
      .select()
      .single();

    if (error) {
      results.push({ email: trimmed, status: 'error', error: error.message });
      continue;
    }

    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() {},
        },
      }
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      trimmed,
      { redirectTo: `${appUrl}/join/${draft_id}` }
    );

    if (inviteError) {
      results.push({ email: trimmed, status: 'invited_no_email', invite_id: invite.id, note: 'User may already exist. Share link manually.' });
    } else {
      results.push({ email: trimmed, status: 'invited', invite_id: invite.id });
    }
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/invites/route.ts
git commit -m "feat: add invites API route (send emails + create records)"
```

---

### Task 7: Create InviteForm Component

**Files:**
- Create: `app/src/components/InviteForm.tsx`

- [ ] **Step 1: Create the invite form component**

Write `app/src/components/InviteForm.tsx`:

```typescript
'use client';

import { useState } from 'react';

interface InviteFormProps {
  draftId: string;
  onInviteSent: () => void;
}

export default function InviteForm({ draftId, onInviteSent }: InviteFormProps) {
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ email: string; status: string; note?: string }> | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);

    const emails = emailInput
      .split(/[,\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setLoading(false);
      return;
    }

    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: draftId, emails }),
    });

    const data = await res.json();

    if (res.ok) {
      setResults(data.results);
      setEmailInput('');
      onInviteSent();
    }

    setLoading(false);
  };

  return (
    <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6">
      <h3 className="text-lg font-bold text-[#c8d9c3] mb-4">Invite Participants</h3>
      <form onSubmit={handleInvite}>
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1 text-[#c8d9c3]">
            Email Addresses
          </label>
          <textarea
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Enter emails separated by commas or new lines&#10;&#10;jake@email.com&#10;uncle.mike@email.com&#10;dad@email.com"
            rows={4}
            className="w-full px-3 py-2 border border-[#141e12] rounded-md bg-[#050a05] text-[#c8d9c3] focus:outline-none focus:ring-2 focus:ring-[#4a7c59] text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors disabled:opacity-50 text-sm"
        >
          {loading ? 'Sending...' : 'Send Invites'}
        </button>
      </form>

      {results && results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`text-sm px-3 py-2 rounded ${
                r.status === 'invited'
                  ? 'bg-[#1a2f1a] text-[#6b9b7a]'
                  : r.status === 'invited_no_email'
                  ? 'bg-[#3d3a1a] text-[#9b8f6b]'
                  : 'bg-red-900/30 text-red-200'
              }`}
            >
              <span className="font-medium">{r.email}</span>
              {r.status === 'invited' && ' — Invite sent'}
              {r.status === 'invited_no_email' && ` — ${r.note}`}
              {r.status === 'error' && ` — Error`}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[#141e12]">
        <p className="text-xs text-[#5a6b57]">
          Or share this link directly:{' '}
          <span className="text-[#6b9b7a] select-all">
            {typeof window !== 'undefined' ? `${window.location.origin}/join/${draftId}` : ''}
          </span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/InviteForm.tsx
git commit -m "feat: add invite form component with email sending and share link"
```

---

### Task 8: Create Participants API Route

**Files:**
- Create: `app/src/app/api/participants/route.ts`

First: `mkdir -p app/src/app/api/participants`

- [ ] **Step 1: Create the participants API route**

Write `app/src/app/api/participants/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { draft_id, team_name } = await request.json();

  if (!draft_id || !team_name) {
    return NextResponse.json({ error: 'draft_id and team_name required' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('draft_participants')
    .select('id')
    .eq('draft_id', draft_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Already registered for this draft' }, { status: 400 });
  }

  const { data: invite } = await supabase
    .from('draft_invites')
    .select('id')
    .eq('draft_id', draft_id)
    .eq('email', user.email)
    .maybeSingle();

  const { data, error } = await supabase
    .from('draft_participants')
    .insert({
      draft_id,
      user_id: user.id,
      team_name,
      invite_id: invite?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (invite) {
    await supabase
      .from('draft_invites')
      .update({ status: 'registered' })
      .eq('id', invite.id);
  }

  return NextResponse.json({ participant: data }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/participants/route.ts
git commit -m "feat: add participants API route (register for draft)"
```

---

### Task 9: Create Participant Registration Page

**Files:**
- Create: `app/src/app/join/[draftId]/page.tsx`

First: `mkdir -p app/src/app/join/\[draftId\]`

- [ ] **Step 1: Create the join/registration page**

This is where participants land after clicking the invite email link. They see draft details, enter their team name, and register.

Write `app/src/app/join/[draftId]/page.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/join/
git commit -m "feat: add participant registration page with draft details and team name"
```

---

### Task 10: Create Draft Detail API Route

**Files:**
- Create: `app/src/app/api/drafts/[id]/route.ts`

First: `mkdir -p app/src/app/api/drafts/\[id\]`

- [ ] **Step 1: Create the single draft API route**

Write `app/src/app/api/drafts/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: draft, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const { data: invites } = await supabase
    .from('draft_invites')
    .select('*')
    .eq('draft_id', id)
    .order('invited_at', { ascending: true });

  const { data: participants } = await supabase
    .from('draft_participants')
    .select('id, team_name, draft_position, has_paid, created_at, user_id')
    .eq('draft_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    draft,
    invites: invites || [],
    participants: participants || [],
    is_admin: draft.admin_user_id === user.id,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/drafts/
git commit -m "feat: add single draft API route with invites and participants"
```

---

### Task 11: Create ParticipantList Component

**Files:**
- Create: `app/src/components/ParticipantList.tsx`

- [ ] **Step 1: Create the participant list component**

Write `app/src/components/ParticipantList.tsx`:

```typescript
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

interface ParticipantListProps {
  participants: Participant[];
  invites: Invite[];
  totalSlots?: number;
}

export default function ParticipantList({ participants, invites, totalSlots }: ParticipantListProps) {
  const pendingInvites = invites.filter((inv) => inv.status === 'pending');
  const registeredCount = participants.length;
  const totalSlotsDisplay = totalSlots || 12;

  return (
    <div className="bg-[#050a05] border border-[#141e12] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#c8d9c3]">Participants</h3>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-[#6b9b7a] font-bold">{registeredCount}</span>
            <span className="text-[#5a6b57]"> / {totalSlotsDisplay} registered</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-4 py-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#6b9b7a]">&#10003;</span>
              <span className="font-medium text-[#c8d9c3]">{p.team_name}</span>
            </div>
            <div className="flex items-center gap-3">
              {p.has_paid ? (
                <span className="text-xs bg-[#1a2f1a] text-[#6b9b7a] px-2 py-1 rounded">Paid</span>
              ) : (
                <span className="text-xs bg-[#3d3a1a] text-[#9b8f6b] px-2 py-1 rounded">Unpaid</span>
              )}
            </div>
          </div>
        ))}

        {pendingInvites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between px-4 py-3 bg-[#0a0f0a] border border-[#141e12] rounded-lg opacity-60"
          >
            <div className="flex items-center gap-3">
              <span className="text-[#888]">&#9675;</span>
              <span className="text-[#5a6b57] italic">{inv.email}</span>
            </div>
            <span className="text-xs text-[#5a6b57]">Pending</span>
          </div>
        ))}

        {registeredCount === 0 && pendingInvites.length === 0 && (
          <div className="text-center text-[#5a6b57] py-6">
            No participants yet. Invite people using the form above.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/ParticipantList.tsx
git commit -m "feat: add participant list component with registered/pending states"
```

---

### Task 12: Create Draft Detail Page

**Files:**
- Create: `app/src/app/dashboard/drafts/[id]/page.tsx`

First: `mkdir -p app/src/app/dashboard/drafts/\[id\]`

- [ ] **Step 1: Create the draft detail page**

This is the main admin view for a draft — shows settings, invite form, participant list.

Write `app/src/app/dashboard/drafts/[id]/page.tsx`:

```typescript
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
              {statusLabels[draft.status] || draft.status} • {draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}
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
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/dashboard/drafts/
git commit -m "feat: add draft detail page with invite form and participant list"
```

---

### Task 13: Support `?next=` redirect on login/signup

**Files:**
- Modify: `app/src/app/auth/login/page.tsx`
- Modify: `app/src/app/auth/signup/page.tsx`

When a participant clicks an invite link and gets redirected to login, the URL will have `?next=/join/[draftId]`. After login, we should redirect them back to that URL.

- [ ] **Step 1: Update login page to support redirect**

In `app/src/app/auth/login/page.tsx`, add redirect support:

Add `useSearchParams` and `useRouter` imports at the top:
```typescript
import { useSearchParams, useRouter } from 'next/navigation';
```

Inside the component, add these hooks:
```typescript
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextUrl = searchParams.get('next') || '/';
```

After a successful login, instead of just waiting for the auth state to change, navigate to `nextUrl`. Update the `handleEmailLogin` function — after the `signInWithEmail` call succeeds (no error), add:
```typescript
    if (!error) {
      router.push(nextUrl);
    }
```

Update the Google sign-in button to pass the redirect URL as a query param:
```typescript
  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };
```

(The Google OAuth redirect is handled by the callback route, which reads the `next` parameter from the Supabase redirect. For simplicity, the existing callback route already redirects to the `next` query param if present.)

- [ ] **Step 2: Update signup page similarly**

Same changes in `app/src/app/auth/signup/page.tsx`: add `useSearchParams` and `useRouter`, read `next` param, redirect after signup if `next` is set.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/src/app/auth/login/page.tsx app/src/app/auth/signup/page.tsx
git commit -m "feat: support redirect after login/signup via ?next= parameter"
```

---

### Task 14: End-to-End Verification

- [ ] **Step 1: Run the build**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build`
Expected: Build succeeds

- [ ] **Step 2: Test admin draft creation**

1. Sign in
2. Click "Dashboard" in nav
3. Click "Create New Draft"
4. Fill out the form with test data
5. Submit -> redirects to draft detail page
6. Draft shows on dashboard listing

- [ ] **Step 3: Test invite flow**

1. On draft detail page, enter an email in the invite form
2. Submit -> invite appears in participant list as "Pending"
3. Check that the invited email received a Supabase invite email (check spam)

- [ ] **Step 4: Test participant registration**

1. Open the shareable link from the draft detail page in an incognito/private window
2. See draft details + "Sign In" / "Create Account" options
3. Create a new account
4. After login, redirected to join page
5. Enter team name -> "You're In!" success message
6. Back on admin's draft detail page, participant shows as registered

- [ ] **Step 5: Run lint**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run lint`
Expected: No new errors
