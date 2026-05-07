# Global Admin Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-draft admin checks (`draft.admin_user_id === user.id`) with a global admin role stored in a `profiles` table, so only global admins can create drafts and manage scores on all drafts.

**Architecture:** New `profiles` table with `role` column (`'admin'` | `'user'`). A `getIsAdmin(userId)` helper queries it. A `GET /api/me` endpoint exposes admin status to the frontend. All API routes and frontend components switch from per-draft admin checks to the global admin check.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js API routes, React hooks

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/007_global_admin.sql` | profiles table + trigger + RLS |
| Create | `app/src/lib/admin.ts` | `getIsAdmin()` server helper |
| Create | `app/src/app/api/me/route.ts` | `GET /api/me` returns `{ isAdmin }` |
| Create | `app/src/hooks/useIsAdmin.ts` | Frontend hook, caches admin status |
| Modify | `app/src/context/auth-context.tsx` | Add `isAdmin` + `adminLoading` to context |
| Modify | `app/src/app/api/drafts/route.ts` | POST: gate create on `getIsAdmin`; DELETE: gate on `getIsAdmin` |
| Modify | `app/src/app/api/drafts/[id]/route.ts` | `is_admin` from `getIsAdmin` |
| Modify | `app/src/app/api/drafts/[id]/scores/route.ts` | `getIsAdmin` check |
| Modify | `app/src/app/api/drafts/[id]/cron-runs/route.ts` | `getIsAdmin` check |
| Modify | `app/src/app/api/drafts/[id]/backfill/route.ts` | `getIsAdmin` check |
| Modify | `app/src/app/api/drafts/[id]/start/route.ts` | `getIsAdmin` check |
| Modify | `app/src/app/api/drafts/[id]/reset/route.ts` | `getIsAdmin` check |
| Modify | `app/src/app/api/drafts/[id]/picks/route.ts` | `getIsAdmin` check for admin_only mode |
| Modify | `app/src/app/api/drafts/[id]/picks/replace/route.ts` | `getIsAdmin` check |
| Modify | `app/src/app/api/drafts/[id]/picks/last/route.ts` | `getIsAdmin` check |
| Modify | `app/src/app/api/invites/route.ts` | `getIsAdmin` check in POST/PATCH/DELETE |
| Modify | `app/src/app/api/participants/route.ts` | `getIsAdmin` check in DELETE/PATCH |
| Modify | `app/src/app/api/dashboard/route.ts` | `isAdmin` from `getIsAdmin` |
| Modify | `app/src/components/Navigation.tsx` | Use `useIsAdmin()` from context |
| Modify | `app/src/app/page.tsx` | Use `useIsAdmin()` from context |
| Modify | `app/src/hooks/useDraftState.ts` | `isAdmin` from `useIsAdmin()` |
| Modify | `app/src/app/dashboard/drafts/[id]/admin/internal/scores/page.tsx` | Use `useIsAdmin()` |
| Modify | `app/src/app/dashboard/drafts/[id]/page.tsx` | Use `useIsAdmin()` |
| Modify | `app/src/app/draft/[id]/coach/page.tsx` | Use `useIsAdmin()` |
| Modify | `app/src/app/draft/[id]/team/page.tsx` | Use `useIsAdmin()` |
| Modify | `app/src/app/draft/[id]/live/page.tsx` | Use `useIsAdmin()` |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/007_global_admin.sql`

- [ ] **Step 1: Write migration file**

```sql
-- 007_global_admin.sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bootstrap existing users
INSERT INTO profiles (id, email, role)
SELECT id, email, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

- [ ] **Step 2: Run migration against Supabase**

```bash
# Apply via Supabase dashboard SQL editor or:
npx supabase db push
```

- [ ] **Step 3: Set your user as admin**

Run in Supabase SQL editor:
```sql
UPDATE profiles SET role = 'admin' WHERE email = '<your-email>';
```

- [ ] **Step 4: Verify**

Run in Supabase SQL editor:
```sql
SELECT id, email, role FROM profiles;
```
Expected: Your email shows `role = 'admin'`, all others show `role = 'user'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_global_admin.sql
git commit -m "feat: add profiles table with global admin role"
```

---

### Task 2: Backend helper `getIsAdmin()`

**Files:**
- Create: `app/src/lib/admin.ts`

- [ ] **Step 1: Create helper**

```ts
import { createClient } from '@/lib/supabase/server';

export async function getIsAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'admin';
}
```

- [ ] **Step 2: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/admin.ts
git commit -m "feat: add getIsAdmin server helper"
```

---

### Task 3: `GET /api/me` endpoint

**Files:**
- Create: `app/src/app/api/me/route.ts`

- [ ] **Step 1: Create endpoint**

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIsAdmin } from '@/lib/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isAdmin: false });
  }

  const isAdmin = await getIsAdmin(user.id);
  return NextResponse.json({ isAdmin });
}
```

- [ ] **Step 2: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/me/route.ts
git commit -m "feat: add GET /api/me endpoint for admin status"
```

---

### Task 4: Frontend `useIsAdmin` hook + AuthContext integration

**Files:**
- Create: `app/src/hooks/useIsAdmin.ts`
- Modify: `app/src/context/auth-context.tsx`

- [ ] **Step 1: Add `isAdmin` and `adminLoading` to AuthContext**

In `app/src/context/auth-context.tsx`, update the interface and provider:

Add to `AuthContextType`:
```ts
isAdmin: boolean;
adminLoading: boolean;
```

Add state inside `AuthProvider`:
```ts
const [isAdmin, setIsAdmin] = useState(false);
const [adminLoading, setAdminLoading] = useState(true);
```

Add a new `useEffect` after the existing auth state effect:
```ts
useEffect(() => {
  if (!user) {
    setIsAdmin(false);
    setAdminLoading(false);
    return;
  }
  fetch('/api/me')
    .then(r => r.ok ? r.json() : { isAdmin: false })
    .then(data => {
      setIsAdmin(data.isAdmin);
      setAdminLoading(false);
    })
    .catch(() => {
      setIsAdmin(false);
      setAdminLoading(false);
    });
}, [user]);
```

Update the Provider value:
```ts
<AuthContext.Provider value={{ user, session, loading, isAdmin, adminLoading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }}>
```

- [ ] **Step 2: Create `useIsAdmin` hook**

```ts
// app/src/hooks/useIsAdmin.ts
'use client';

import { useAuth } from '@/context/auth-context';

export function useIsAdmin() {
  const { isAdmin, adminLoading } = useAuth();
  return { isAdmin, loading: adminLoading };
}
```

- [ ] **Step 3: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```
Expected: Build succeeds. (Components still import from old locations — we'll update them in later tasks.)

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useIsAdmin.ts app/src/context/auth-context.tsx
git commit -m "feat: add useIsAdmin hook with AuthContext integration"
```

---

### Task 5: Update API routes — drafts

**Files:**
- Modify: `app/src/app/api/drafts/route.ts` (POST + DELETE)
- Modify: `app/src/app/api/drafts/[id]/route.ts` (GET `is_admin`)

- [ ] **Step 1: Update `POST /api/drafts` — gate create on `getIsAdmin`**

In `app/src/app/api/drafts/route.ts`:

Add import at top:
```ts
import { getIsAdmin } from '@/lib/admin';
```

In the `POST` function, after the `if (!user)` check (line ~88), add:
```ts
const adminCheck = await getIsAdmin(user.id);
if (!adminCheck) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

In the `DELETE` function, replace lines 166-168:
```ts
// Before:
if (draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
}

// After:
const adminCheck = await getIsAdmin(user.id);
if (!adminCheck) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

- [ ] **Step 2: Update `GET /api/drafts/[id]` — `is_admin` from `getIsAdmin`**

In `app/src/app/api/drafts/[id]/route.ts`:

Add import at top:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace line 49:
```ts
// Before:
is_admin: draft.admin_user_id === user.id,

// After:
is_admin: await getIsAdmin(user.id),
```

- [ ] **Step 3: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/drafts/route.ts app/src/app/api/drafts/\[id\]/route.ts
git commit -m "feat: gate draft create/delete on global admin role"
```

---

### Task 6: Update API routes — score management

**Files:**
- Modify: `app/src/app/api/drafts/[id]/scores/route.ts`
- Modify: `app/src/app/api/drafts/[id]/cron-runs/route.ts`
- Modify: `app/src/app/api/drafts/[id]/backfill/route.ts`

- [ ] **Step 1: Update `PATCH /api/drafts/[id]/scores`**

In `app/src/app/api/drafts/[id]/scores/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace lines 14-17:
```ts
// Before:
const { data: draft } = await supabase
  .from('drafts').select('admin_user_id, scoring_format').eq('id', id).single();
if (!draft || draft.admin_user_id !== user.id)
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

// After:
const { data: draft } = await supabase
  .from('drafts').select('scoring_format').eq('id', id).single();
if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
if (!await getIsAdmin(user.id))
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
```

- [ ] **Step 2: Update `GET /api/drafts/[id]/cron-runs`**

In `app/src/app/api/drafts/[id]/cron-runs/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace lines 13-16:
```ts
// Before:
const { data: draft } = await supabase
  .from('drafts').select('admin_user_id').eq('id', id).single();
if (!draft || draft.admin_user_id !== user.id)
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

// After:
if (!await getIsAdmin(user.id))
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
```

- [ ] **Step 3: Update `POST /api/drafts/[id]/backfill`**

In `app/src/app/api/drafts/[id]/backfill/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace lines 15-18:
```ts
// Before:
const { data: draft } = await supabase
  .from('drafts').select('admin_user_id, scoring_format, season_type').eq('id', id).single();
if (!draft || draft.admin_user_id !== user.id)
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

// After:
const { data: draft } = await supabase
  .from('drafts').select('scoring_format, season_type').eq('id', id).single();
if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
if (!await getIsAdmin(user.id))
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
```

- [ ] **Step 4: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/drafts/\[id\]/scores/route.ts app/src/app/api/drafts/\[id\]/cron-runs/route.ts app/src/app/api/drafts/\[id\]/backfill/route.ts
git commit -m "feat: gate score/cron/backfill routes on global admin"
```

---

### Task 7: Update API routes — draft control (start, reset, picks)

**Files:**
- Modify: `app/src/app/api/drafts/[id]/start/route.ts`
- Modify: `app/src/app/api/drafts/[id]/reset/route.ts`
- Modify: `app/src/app/api/drafts/[id]/picks/route.ts`
- Modify: `app/src/app/api/drafts/[id]/picks/replace/route.ts`
- Modify: `app/src/app/api/drafts/[id]/picks/last/route.ts`

- [ ] **Step 1: Update `POST /api/drafts/[id]/start`**

In `app/src/app/api/drafts/[id]/start/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace lines 27-29:
```ts
// Before:
if (draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
}

// After:
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

- [ ] **Step 2: Update `POST /api/drafts/[id]/reset`**

In `app/src/app/api/drafts/[id]/reset/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace lines 27-29:
```ts
// Before:
if (draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}

// After:
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

Also simplify the draft query (line 17-21) — no longer need `admin_user_id`:
```ts
// Before:
.select('id, admin_user_id')

// After:
.select('id')
```

- [ ] **Step 3: Update `POST /api/drafts/[id]/picks`**

In `app/src/app/api/drafts/[id]/picks/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace line 65:
```ts
// Before:
const isAdmin = draft.admin_user_id === user.id;

// After:
const isAdmin = await getIsAdmin(user.id);
```

- [ ] **Step 4: Update `POST /api/drafts/[id]/picks/replace`**

In `app/src/app/api/drafts/[id]/picks/replace/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace lines 27-29:
```ts
// Before:
if (draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}

// After:
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

Also simplify the draft query (line 17-21):
```ts
// Before:
.select('id, admin_user_id, status')

// After:
.select('id, status')
```

- [ ] **Step 5: Update `DELETE /api/drafts/[id]/picks/last`**

In `app/src/app/api/drafts/[id]/picks/last/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace lines 27-29:
```ts
// Before:
if (draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}

// After:
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

Also simplify the draft query (line 17-21):
```ts
// Before:
.select('id, admin_user_id, status, current_round, current_pick')

// After:
.select('id, status, current_round, current_pick')
```

- [ ] **Step 6: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add app/src/app/api/drafts/\[id\]/start/route.ts app/src/app/api/drafts/\[id\]/reset/route.ts app/src/app/api/drafts/\[id\]/picks/route.ts app/src/app/api/drafts/\[id\]/picks/replace/route.ts app/src/app/api/drafts/\[id\]/picks/last/route.ts
git commit -m "feat: gate draft control routes on global admin"
```

---

### Task 8: Update API routes — invites and participants

**Files:**
- Modify: `app/src/app/api/invites/route.ts`
- Modify: `app/src/app/api/participants/route.ts`

- [ ] **Step 1: Update invites route (POST, PATCH, DELETE)**

In `app/src/app/api/invites/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

**POST function** — replace lines 28-29:
```ts
// Before:
if (!draft || draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
}

// After:
if (!draft) {
  return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
}
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

Change the draft query to only select `name`:
```ts
// Before:
.select('admin_user_id, name')

// After:
.select('name')
```

**PATCH function** — replace lines 100-101:
```ts
// Before:
if (!draft || draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
}

// After:
if (!draft) {
  return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
}
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

Change the draft query in PATCH:
```ts
// Before:
.select('admin_user_id, name')

// After:
.select('name')
```

**DELETE function** — replace lines 153-154:
```ts
// Before:
if (!draft || draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
}

// After:
if (!draft) {
  return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
}
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

Change the draft query in DELETE:
```ts
// Before:
.select('admin_user_id')

// After:
.select('id')
```

- [ ] **Step 2: Update participants route (DELETE, PATCH)**

In `app/src/app/api/participants/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

**DELETE function** — replace lines 103-105:
```ts
// Before:
if (!draft || draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
}

// After:
if (!draft) {
  return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
}
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

**PATCH function** — replace lines 149-151:
```ts
// Before:
if (!draft || draft.admin_user_id !== user.id) {
  return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
}

// After:
if (!draft) {
  return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
}
if (!await getIsAdmin(user.id)) {
  return NextResponse.json({ error: 'Admin only' }, { status: 403 });
}
```

- [ ] **Step 3: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/invites/route.ts app/src/app/api/participants/route.ts
git commit -m "feat: gate invite/participant routes on global admin"
```

---

### Task 9: Update dashboard API route

**Files:**
- Modify: `app/src/app/api/dashboard/route.ts`

- [ ] **Step 1: Update `isAdmin` check**

In `app/src/app/api/dashboard/route.ts`:

Add import:
```ts
import { getIsAdmin } from '@/lib/admin';
```

Replace line 203:
```ts
// Before:
const isAdmin = draft.admin_user_id === user.id;

// After:
const isAdmin = await getIsAdmin(user.id);
```

- [ ] **Step 2: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/dashboard/route.ts
git commit -m "feat: use global admin check in dashboard API"
```

---

### Task 10: Update frontend components

**Files:**
- Modify: `app/src/components/Navigation.tsx`
- Modify: `app/src/app/page.tsx`
- Modify: `app/src/hooks/useDraftState.ts`

- [ ] **Step 1: Update Navigation to use `useIsAdmin()`**

In `app/src/components/Navigation.tsx`:

Remove the `useState(isAdmin)` and the `useEffect` that fetches `/api/drafts` (lines 13, 16-22).

Change the import of `useAuth` — no change needed, already imported.

Replace `isAdmin` usage with `useIsAdmin`:

Add import:
```ts
import { useIsAdmin } from '@/hooks/useIsAdmin';
```

Inside the component, after `const { user, loading, signOut } = useAuth();`:
```ts
const { isAdmin } = useIsAdmin();
```

Remove lines 13 and 16-22 entirely (the `useState` and `useEffect` for admin).

- [ ] **Step 2: Update dashboard `page.tsx` to use `useIsAdmin()`**

In `app/src/app/page.tsx`:

Add import:
```ts
import { useIsAdmin } from '@/hooks/useIsAdmin';
```

Inside the component, add:
```ts
const { isAdmin: globalIsAdmin } = useIsAdmin();
```

Replace all references to the dashboard API's `isAdmin` with `globalIsAdmin`. In the `fetchDashboard` callback, remove `isAdmin` from the destructured response, or keep it but prefer `globalIsAdmin` for UI rendering.

Specifically, in the `DashboardData` interface, change line 13:
```ts
// Before:
isAdmin: boolean;

// After (keep for API response typing, but don't use for UI):
// Remove this field or keep unused — we'll use globalIsAdmin instead
```

Actually, simplest approach: keep `isAdmin` in `DashboardData` for API typing, but in the JSX replace `isAdmin` with `globalIsAdmin`. The dashboard `useState` can still destructure it from the API but the rendering checks use `globalIsAdmin`.

Find all `isAdmin` references in JSX (lines ~203, etc.) and replace with `globalIsAdmin`.

- [ ] **Step 3: Update `useDraftState.ts` to use `useIsAdmin()`**

In `app/src/hooks/useDraftState.ts`:

Add import:
```ts
import { useIsAdmin } from './useIsAdmin'
```

Inside the hook function, add:
```ts
const { isAdmin: globalIsAdmin } = useIsAdmin()
```

Remove the local `isAdmin` state (line 125):
```ts
// Remove:
const [isAdmin, setIsAdmin] = useState(false)
```

In the fetch callbacks, remove `setIsAdmin(data.is_admin)` calls (lines 135, 167).

In the return object, replace `isAdmin` with `globalIsAdmin`:
```ts
// Before:
isAdmin,

// After:
isAdmin: globalIsAdmin,
```

- [ ] **Step 4: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Navigation.tsx app/src/app/page.tsx app/src/hooks/useDraftState.ts
git commit -m "feat: use global admin hook in Navigation, Dashboard, useDraftState"
```

---

### Task 11: Update remaining frontend pages

**Files:**
- Modify: `app/src/app/dashboard/drafts/[id]/admin/internal/scores/page.tsx`
- Modify: `app/src/app/dashboard/drafts/[id]/page.tsx`
- Modify: `app/src/app/draft/[id]/coach/page.tsx`
- Modify: `app/src/app/draft/[id]/team/page.tsx`
- Modify: `app/src/app/draft/[id]/live/page.tsx`

- [ ] **Step 1: Update scores admin page**

In `app/src/app/dashboard/drafts/[id]/admin/internal/scores/page.tsx`:

Add import:
```ts
import { useIsAdmin } from '@/hooks/useIsAdmin';
```

Inside the component, add:
```ts
const { isAdmin } = useIsAdmin();
```

Remove the local `const [isAdmin, setIsAdmin] = useState(false);` and the fetch that sets it from `data?.is_admin`. Keep the fetch for draft data but remove the admin check from the response.

In the auth guard (line ~296), keep the redirect but use the hook's `isAdmin` directly:
```ts
if (!authChecked || (!isAdmin && authChecked)) {
```

- [ ] **Step 2: Update draft config page**

In `app/src/app/dashboard/drafts/[id]/page.tsx`:

Add import:
```ts
import { useIsAdmin } from '@/hooks/useIsAdmin';
```

Inside the component, add:
```ts
const { isAdmin } = useIsAdmin();
```

Remove the local `const [isAdmin, setIsAdmin] = useState(false);` and the `setIsAdmin(data.is_admin)` call.

- [ ] **Step 3: Update coach, team, and live draft pages**

For each of these files (`coach/page.tsx`, `team/page.tsx`, `live/page.tsx`), they receive `isAdmin` from `useDraftState` which now uses `useIsAdmin()` under the hood (updated in Task 10). No changes needed in these files — they already get `isAdmin` from the hook's return value.

- [ ] **Step 4: Verify build**

```bash
cd app && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add app/src/app/dashboard/drafts/\[id\]/admin/internal/scores/page.tsx app/src/app/dashboard/drafts/\[id\]/page.tsx
git commit -m "feat: use global admin hook in scores and draft config pages"
```

---

### Task 12: Final verification and cleanup

- [ ] **Step 1: Search for any remaining `admin_user_id === user.id` checks**

```bash
cd app && grep -rn "admin_user_id === user.id" src/
```
Expected: No matches (all replaced with `getIsAdmin`).

- [ ] **Step 2: Search for any remaining `draft.admin_user_id` permission checks**

```bash
cd app && grep -rn "admin_user_id" src/app/api/
```
Expected: Only in `drafts/route.ts` POST where `admin_user_id: user.id` is set on draft creation (this is correct — we still track who created it).

- [ ] **Step 3: Full build**

```bash
cd app && npm run build
```
Expected: Clean build, no errors.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A && git commit -m "chore: cleanup remaining admin_user_id references"
```
