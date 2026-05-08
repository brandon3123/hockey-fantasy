# Edit Draft Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to edit draft configuration fields at any time after creation.

**Architecture:** Add a PATCH handler to the existing `/api/drafts/[id]` route. On the config page, toggle between read-only and edit modes, reusing the existing `DraftSetupForm` component with pre-filled data.

**Tech Stack:** Next.js App Router, Supabase, React state

---

### Task 1: Add PATCH handler to `/api/drafts/[id]`

**Files:**
- Modify: `src/app/api/drafts/[id]/route.ts`

- [ ] **Step 1: Add PATCH export**

Add the following PATCH handler to `src/app/api/drafts/[id]/route.ts` after the existing GET handler:

```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminCheck = await getIsAdmin(user.id);
  if (!adminCheck) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from('drafts')
    .select('id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = [
    'name', 'season_type', 'draft_date', 'draft_time', 'location',
    'entry_fee', 'currency', 'payment_method', 'payment_info',
    'notes', 'players_per_team', 'scoring_format',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('drafts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: data });
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Clean build with no errors.

---

### Task 2: Update DraftSetupForm to support edit mode

**Files:**
- Modify: `src/components/DraftSetupForm.tsx`

- [ ] **Step 1: Add `isEditing` prop and change redirect behavior**

In `DraftSetupForm`, add an `isEditing` prop. When `isEditing` is true, the `onSubmit` callback returns the result and the form does NOT call `router.push`. The parent page handles the result instead.

Update the interface:

```ts
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
  isEditing?: boolean;
}
```

Update the destructured props:

```ts
export default function DraftSetupForm({ initialData, onSubmit, submitLabel = 'Create Draft', isEditing }: DraftSetupFormProps) {
```

Update the submit handler — replace the `if (result.draft?.id)` block:

```ts
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (!isEditing && result.draft?.id) {
      router.push(`/dashboard/drafts/${result.draft.id}`);
    }

    setLoading(false);
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Clean build.

---

### Task 3: Add edit mode to config page

**Files:**
- Modify: `src/app/dashboard/drafts/[id]/page.tsx`

- [ ] **Step 1: Add edit state and import**

Add `DraftSetupForm` to imports and add `editingConfig` state. At the top of the component, add state:

```ts
const [editingConfig, setEditingConfig] = useState(false);
```

Import `DraftSetupForm`:

```ts
import DraftSetupForm from '@/components/DraftSetupForm';
```

- [ ] **Step 2: Add PATCH submit handler**

Add a handler function before the `useEffect`:

```ts
const handleUpdateDraft = async (data: Record<string, unknown>) => {
  const res = await fetch(`/api/drafts/${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) {
    return { error: result.error || 'Failed to update draft' };
  }
  setEditingConfig(false);
  fetchDraft();
  return { draft: result.draft };
};
```

- [ ] **Step 3: Replace the Event Details section**

Replace the entire "Event Details" section (the `<div className="mb-6">` containing the read-only grid) with this conditional block. This goes right after the header section, before the `{isPreDraft && (` "Your Team Name" section:

```tsx
        {editingConfig ? (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Edit Draft Config</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            <DraftSetupForm
              initialData={draft}
              onSubmit={handleUpdateDraft}
              submitLabel="Save Changes"
              isEditing
            />
            <button
              onClick={() => setEditingConfig(false)}
              className="w-full py-2 mt-2 text-sm text-[#5a6b57] hover:text-[#c8d9c3] transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Event Details</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              {isAdmin && (
                <button
                  onClick={() => setEditingConfig(true)}
                  className="text-xs text-[#5a6b57] hover:text-[#6b9b7a] transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            {/* ... existing read-only grid stays exactly the same ... */}
          </div>
        )}
```

The read-only grid content (the `<div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl p-5">` block with all the `{draft.draft_date && ...}` rows) stays unchanged inside the else branch.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/drafts/[id]/route.ts src/components/DraftSetupForm.tsx src/app/dashboard/drafts/[id]/page.tsx
git commit -m "feat: allow admins to edit draft config after creation"
```
