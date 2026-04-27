# Phase 2 Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 issues from Phase 2 testing: date picker with no past dates, custom Supabase email template, remove participants/invites, and date server-side validation.

**Architecture:** Frontend changes to DraftSetupForm and ParticipantList components. New DELETE handlers on invites and participants API routes. Supabase email template customization is a dashboard config (provided as documentation, not code).

**Tech Stack:** Next.js 15, Supabase, TypeScript

---

## File Structure

### Modified Files
- `app/src/components/DraftSetupForm.tsx` — Add `min` date restriction, improve date input styling
- `app/src/components/ParticipantList.tsx` — Add remove buttons with callbacks
- `app/src/app/api/invites/route.ts` — Add DELETE handler
- `app/src/app/api/participants/route.ts` — Add DELETE handler
- `app/src/app/api/drafts/route.ts` — Add server-side date validation
- `app/src/app/dashboard/drafts/[id]/page.tsx` — Wire up remove handlers

---

### Task 1: Add Date Validation to DraftSetupForm

**Files:**
- Modify: `app/src/components/DraftSetupForm.tsx`

- [ ] **Step 1: Add min date restriction to the date input**

In `app/src/components/DraftSetupForm.tsx`, add a computed `today` string and apply it as the `min` attribute on the date input.

Add this after the state declarations (after line 41):

```typescript
  const today = new Date().toISOString().split('T')[0];
```

Replace the date input (line 114):

```typescript
              <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} min={today} className={inputClass} />
```

Also add a custom color scheme for the date picker calendar. Add this CSS class or inline style — the native date picker respects `color-scheme: dark`. Add `style={{ colorScheme: 'dark' }}` to the date input.

Final date input line:

```typescript
              <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} min={today} className={inputClass} style={{ colorScheme: 'dark' }} />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/components/DraftSetupForm.tsx
git commit -m "feat: add min date restriction and dark color scheme to date picker"
```

---

### Task 2: Add Server-Side Date Validation

**Files:**
- Modify: `app/src/app/api/drafts/route.ts`

- [ ] **Step 1: Add past date check to the POST handler**

In `app/src/app/api/drafts/route.ts`, add validation after the body destructuring (after line 47) and before the insert:

```typescript
  if (draft_date) {
    const selectedDate = new Date(draft_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return NextResponse.json({ error: 'Draft date cannot be in the past' }, { status: 400 });
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/drafts/route.ts
git commit -m "feat: add server-side validation for past draft dates"
```

---

### Task 3: Add DELETE Handler to Invites API

**Files:**
- Modify: `app/src/app/api/invites/route.ts`

- [ ] **Step 1: Add DELETE handler**

Append to `app/src/app/api/invites/route.ts` (after the closing brace of the POST function):

```typescript

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { invite_id } = await request.json();

  if (!invite_id) {
    return NextResponse.json({ error: 'invite_id required' }, { status: 400 });
  }

  const { data: invite } = await supabase
    .from('draft_invites')
    .select('id, draft_id')
    .eq('id', invite_id)
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', invite.draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  const { error } = await supabase
    .from('draft_invites')
    .delete()
    .eq('id', invite_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/invites/route.ts
git commit -m "feat: add DELETE handler for removing draft invites"
```

---

### Task 4: Add DELETE Handler to Participants API

**Files:**
- Modify: `app/src/app/api/participants/route.ts`

- [ ] **Step 1: Add DELETE handler**

Append to `app/src/app/api/participants/route.ts` (after the closing brace of the POST function):

```typescript

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { participant_id } = await request.json();

  if (!participant_id) {
    return NextResponse.json({ error: 'participant_id required' }, { status: 400 });
  }

  const { data: participant } = await supabase
    .from('draft_participants')
    .select('id, draft_id')
    .eq('id', participant_id)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', participant.draft_id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  const { error } = await supabase
    .from('draft_participants')
    .delete()
    .eq('id', participant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/participants/route.ts
git commit -m "feat: add DELETE handler for removing draft participants"
```

---

### Task 5: Update ParticipantList with Remove Buttons

**Files:**
- Modify: `app/src/components/ParticipantList.tsx`

- [ ] **Step 1: Add onRemoveInvite and onRemoveParticipant callbacks**

Replace the entire file `app/src/components/ParticipantList.tsx`:

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
  onRemoveParticipant?: (id: string) => void;
  onRemoveInvite?: (id: string) => void;
}

export default function ParticipantList({ participants, invites, totalSlots, onRemoveParticipant, onRemoveInvite }: ParticipantListProps) {
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
              {onRemoveParticipant && (
                <button
                  onClick={() => onRemoveParticipant(p.id)}
                  className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm"
                  title="Remove participant"
                >
                  &#10005;
                </button>
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
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#5a6b57]">Pending</span>
              {onRemoveInvite && (
                <button
                  onClick={() => onRemoveInvite(inv.id)}
                  className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm"
                  title="Cancel invite"
                >
                  &#10005;
                </button>
              )}
            </div>
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
git commit -m "feat: add remove buttons to participant and invite list items"
```

---

### Task 6: Wire Remove Handlers in Draft Detail Page

**Files:**
- Modify: `app/src/app/dashboard/drafts/[id]/page.tsx`

- [ ] **Step 1: Add remove handler functions and pass them to ParticipantList**

In `app/src/app/dashboard/drafts/[id]/page.tsx`, add these handler functions after the `fetchDraft` function (after line 61):

```typescript
  const handleRemoveParticipant = async (id: string) => {
    const res = await fetch('/api/participants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: id }),
    });
    if (res.ok) {
      fetchDraft();
    }
  };

  const handleRemoveInvite = async (id: string) => {
    const res = await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: id }),
    });
    if (res.ok) {
      fetchDraft();
    }
  };
```

Update the `ParticipantList` component usage (around line 157-160) to pass the new props:

```typescript
          <ParticipantList
            participants={participants}
            invites={invites}
            onRemoveParticipant={handleRemoveParticipant}
            onRemoveInvite={handleRemoveInvite}
          />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/dashboard/drafts/[id]/page.tsx
git commit -m "feat: wire up remove handlers for participants and invites"
```

---

### Task 7: Customize Supabase Invite Email Template

This is a **Supabase Dashboard configuration**, not code. The following steps are performed in the Supabase dashboard.

- [ ] **Step 1: Update the "Invite User" email template**

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/hwuahipaobfkhlhvichx/auth/templates
2. Select **"Invite User"** from the template dropdown
3. Replace the template with the following HTML:

```html
<h2 style="color:#c8d9c3;font-family:system-ui,sans-serif;">You&apos;re Invited to a Hockey Draft!</h2>

<p style="color:#8a9b87;font-family:system-ui,sans-serif;font-size:16px;line-height:1.6;">
  Someone has invited you to join their hockey fantasy draft.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center">
      <a href="{{ .ConfirmationURL }}" style="background-color:#4a7c59;color:#c8d9c3;padding:14px 28px;border-radius:8px;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600;font-size:16px;display:inline-block;">
        Join the Draft
      </a>
    </td>
  </tr>
</table>

<p style="color:#8a9b87;font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;">
  Click the button above to create your account and pick your team name. If the button doesn&apos;t work, copy and paste this link into your browser:
</p>

<p style="color:#6b9b7a;font-family:monospace;font-size:13px;word-break:break-all;">
  {{ .ConfirmationURL }}
</p>

<hr style="border:none;border-top:1px solid #1a2418;margin:24px 0;" />

<p style="color:#5a6b57;font-family:system-ui,sans-serif;font-size:12px;">
  If you weren&apos;t expecting this invitation, you can safely ignore this email.
</p>
```

4. Click **Save**

- [ ] **Step 2: Update the email subject line**

In the same template editor, change the subject line from the default to:

```
You're Invited to Join a Hockey Fantasy Draft!
```

- [ ] **Step 3: Update the "Confirm Signup" template too**

While you're there, also update the **"Confirm Signup"** template for users who sign up directly via the join link:

Subject: `Confirm Your Hockey Fantasy Account`

```html
<h2 style="color:#c8d9c3;font-family:system-ui,sans-serif;">Confirm Your Account</h2>

<p style="color:#8a9b87;font-family:system-ui,sans-serif;font-size:16px;line-height:1.6;">
  Click the button below to confirm your email and get started with your hockey fantasy draft.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center">
      <a href="{{ .ConfirmationURL }}" style="background-color:#4a7c59;color:#c8d9c3;padding:14px 28px;border-radius:8px;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600;font-size:16px;display:inline-block;">
        Confirm Email
      </a>
    </td>
  </tr>
</table>

<p style="color:#8a9b87;font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;">
  If the button doesn&apos;t work, copy and paste this link:
</p>

<p style="color:#6b9b7a;font-family:monospace;font-size:13px;word-break:break-all;">
  {{ .ConfirmationURL }}
</p>

<hr style="border:none;border-top:1px solid #1a2418;margin:24px 0;" />

<p style="color:#5a6b57;font-family:system-ui,sans-serif;font-size:12px;">
  If you didn&apos;t create an account, you can safely ignore this email.
</p>
```

- [ ] **Step 4: Commit (documentation only)**

```bash
git add docs/superpowers/plans/2026-04-26-phase2-fixes.md
git commit -m "docs: add phase 2 fixes plan with email template instructions"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors (4 pre-existing errors in rosters/DraftCoach should be gone now from earlier fix)

- [ ] **Step 2: Run build**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run lint`
Expected: Only warnings (no errors)
