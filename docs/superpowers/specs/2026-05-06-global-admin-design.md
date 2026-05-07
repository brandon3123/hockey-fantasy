# Global Admin Role

## Problem

Admin permissions are currently per-draft (`drafts.admin_user_id === user.id`). This means:
- Any user can create drafts
- Only the draft creator can manage scores, invites, participants, etc.
- No global admin concept exists

## Solution

Add a `profiles` table with a `role` column (`'admin' | 'user'`). Global admins can:
- Create drafts
- Manage scores, cron, backfill on **all** drafts
- Start/reset any draft
- Send invites, manage participants on any draft
- Delete any draft

## Database

### New table: `profiles`

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Auto-create profile on signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Bootstrap existing users

Insert profiles for all existing auth users, then elevate the admin:

```sql
INSERT INTO profiles (id, email, role)
SELECT id, email, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET role = 'admin' WHERE email = '<admin-email>';
```

### RLS policies

```sql
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

## Backend

### Helper: `app/src/lib/admin.ts`

```ts
import { createServerClient } from '@/lib/supabase/server';

export async function getIsAdmin(userId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'admin';
}
```

### API endpoint: `GET /api/me`

Returns `{ isAdmin: boolean }` by checking `profiles.role`. Used by frontend to determine admin status without coupling to a specific draft.

```ts
// app/src/app/api/me/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ isAdmin: false });
  const isAdmin = await getIsAdmin(user.id);
  return NextResponse.json({ isAdmin });
}
```

### API routes to update (12 files)

Every route that checks `draft.admin_user_id === user.id` switches to `await getIsAdmin(user.id)`:

| Route | Action | Current check |
|---|---|---|
| `POST /api/drafts` | Create draft | No check (anyone can create) |
| `DELETE /api/drafts/[id]` | Delete draft | `admin_user_id === user.id` |
| `GET /api/drafts/[id]` | Return `is_admin` flag | `admin_user_id === user.id` |
| `PATCH /api/drafts/[id]/scores` | Edit scores | `admin_user_id === user.id` |
| `GET /api/drafts/[id]/cron-runs` | View cron log | `admin_user_id === user.id` |
| `POST /api/drafts/[id]/backfill` | Run backfill | `admin_user_id === user.id` |
| `POST /api/drafts/[id]/start` | Start draft | `admin_user_id === user.id` |
| `POST /api/drafts/[id]/reset` | Reset draft | `admin_user_id === user.id` |
| `POST /api/drafts/[id]/picks` | Submit pick | `admin_user_id === user.id` |
| `POST /api/drafts/[id]/picks/replace` | Replace pick | `admin_user_id === user.id` |
| `DELETE /api/drafts/[id]/picks/last` | Undo pick | `admin_user_id === user.id` |
| `POST/PATCH/DELETE /api/invites` | Manage invites | `admin_user_id === user.id` |
| `PATCH/DELETE /api/participants` | Manage participants | `admin_user_id === user.id` |

`drafts.admin_user_id` column stays — tracks who created the draft, still set on creation, just no longer used for permission checks.

### `GET /api/drafts/[id]` response change

Before: `is_admin: draft.admin_user_id === user.id`
After: `is_admin: await getIsAdmin(user.id)`

## Frontend

### Hook: `app/src/hooks/useIsAdmin.ts`

```ts
// Calls GET /api/me once, caches result
// Returns { isAdmin: boolean, loading: boolean }
```

### Components to update

| Component | Before | After |
|---|---|---|
| `Navigation.tsx` | Heuristic: `drafts.length > 0` | `useIsAdmin()` hook |
| `page.tsx` (dashboard) | `isAdmin` from dashboard API | `useIsAdmin()` hook |
| `scores/page.tsx` | `is_admin` from draft API | `useIsAdmin()` hook |
| `drafts/[id]/page.tsx` | `is_admin` from draft API | `useIsAdmin()` hook |
| `useDraftState.ts` | `is_admin` from draft API | `useIsAdmin()` hook |

### Admin-gated UI elements

- "Create New Draft" button in Navigation
- "Manage Scores" button on dashboard
- Delete draft button on dashboard
- Admin controls in live draft board (start, reset, undo)
- Draft config page controls
- Score manager page access

## What does NOT change

- `drafts.admin_user_id` column stays — still tracks draft creator
- Draft creator still auto-joins as participant
- Non-admin users see the same UI (join, view standings, results, etc.)
- Player-facing pages (standings, results, games, rankings) unchanged
- Cron handler unchanged (runs server-side, no user auth)

## Migration plan

1. Run `007_global_admin.sql` migration
2. Bootstrap existing users into profiles table
3. Set admin user role via SQL
4. Deploy backend changes (admin.ts, /api/me, updated API routes)
5. Deploy frontend changes (useIsAdmin hook, updated components)
6. Verify admin user sees all controls, regular user sees none
