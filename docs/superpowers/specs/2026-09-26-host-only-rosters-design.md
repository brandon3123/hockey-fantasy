# Host-Only Roster Drafts (Invites Optional)

**Date:** 2026-09-26
**Status:** Approved in chat, pending implementation planning
**Author:** Brainstorm session with Brandon (decisions recorded below)

## Problem

Today there are two disconnected ways to draft:

1. **Hosted drafts** (dashboard → create → invites → join → start). Persistent: picks,
   standings, scoring, coach history all live in Supabase. But entry requires the
   invite → email → accept flow, one participant per user account, and the start modal
   expects a participant roster assembled from invite acceptances.
2. **External draft** (`/draft`). Fast and flexible — type manager names, set pick
   order, click any player onto any team — but everything lives in React state and
   vanishes with the browser tab. No scoring, no standings, no history.

Brandon runs draft night in a room with a laptop. He wants the external draft's
friction-free setup and the hosted draft's persistence to be the **same flow**: type in
the people in the room, skip accounts and invites entirely, run the draft, and let the
normal post-draft machinery (dashboard, standings, scores, coach) track it.

## Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Who enters picks during the live draft? | **Just the host**, from one screen (like today's `/draft`); other managers are names, never accounts |
| Where does that screen live? | **Enhance `/draft`** — no separate host page; `/draft` keeps working standalone when not bound to a draft |
| Where are team names entered? | **On the create-draft form**, inline (like manager names on `/draft`); draft is startable immediately, no invite step |
| Draft order | **Typed order = draft order** (reorderable on the start modal); no free-form per-team slot assignment |
| Post-draft life | **Full tracking** — standings, scores, dashboard, coach history |
| Team names | **Free text**, no validation beyond non-empty and unique within the draft |

## Design

### 1. Data model (migration `008_host_only_participants.sql`)

Current blocker: `draft_participants.user_id` is `NOT NULL` with
`UNIQUE(draft_id, user_id)` — a participant *must* be an account.

```sql
ALTER TABLE draft_participants ALTER COLUMN user_id DROP NOT NULL;

-- One seat per team name per draft (replaces the per-user unique pair).
ALTER TABLE draft_participants DROP CONSTRAINT draft_participants_draft_id_user_id_key;
ALTER TABLE draft_participants ADD CONSTRAINT draft_participants_draft_id_team_name_key UNIQUE (draft_id, team_name);

CREATE INDEX draft_participants_draft_id_position_idx
  ON draft_participants (draft_id, draft_position);

-- Name-only seats are visible to the draft admin only.
DROP POLICY IF EXISTS "Users can view participants of their drafts" ON draft_participants;
CREATE POLICY "Users can view participants of their drafts" ON draft_participants FOR SELECT USING (
  user_id = auth.uid()
  OR draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
```

Notes:
- `draft_position` stays INTEGER and NULL until the draft starts, preserving today's
  behavior.
- A user account CAN hold more than one seat in a draft now (the per-user unique pair
  is gone). This is intentional: the host may put themselves in the room under their
  own name and enter picks for everyone. Nothing else depends on one-seat-per-user.
- The RLS change replaces the single policy touched in `004_fix_participant_rls.sql`;
  its shape (SELECT-only change) is mirrored there.

### 2. Drafts gain `participant_mode`

New column on `drafts` (same migration):

```sql
ALTER TABLE drafts ADD COLUMN participant_mode TEXT NOT NULL DEFAULT 'invite'
  CHECK (participant_mode IN ('invite', 'roster'));
```

- `'invite'`: today's flow, untouched. Default for all existing rows.
- `'roster'`: the new host-only flow. Participants are created up front from typed
  names; `/api/participants` (join-by-invite) is not used.

### 3. Create flow (form + API)

**`DraftSetupForm.tsx`:** add a **"Players" editor** behind a mode toggle:

- A segmented toggle: `With invites` (default) / `In room (no invites)` — writes
  `participant_mode: 'invite' | 'roster'` in the payload.
- When `roster` is selected: a name list UI identical in spirit to `/draft`'s manager
  names — rows of free-text inputs with add/remove and reorder (up/down arrows only;
  this is a small form, not the start modal), with count constraints:
  minimum 2, maximum 20.
- Names are trimmed; duplicates within the list are rejected client-side (the DB
  unique index is the backstop).
- A "seat me in this draft too" checkbox (default on) appends one extra name row
  labeled with the admin's display name placeholder ("You"), creating an account-backed
  participant for the admin at the end of the list (position = list index). If off, the
  admin has no seat and no "my roster" view; standings still render (admin sees all).

**`POST /api/drafts`:** when `participant_mode === 'roster'`:
- Validate `participants: string[]` — length 2..20, non-empty after trim, unique.
- Insert the draft row (as today) with `participant_mode: 'roster'`.
- When "seat me" is checked, create the admin's participant first (user_id = caller,
  team_name from a `my_name` field if provided, else 'Commissioner'), then one row per
  typed name (`user_id: null`), `draft_position = i+1` in list order.
- All inserts via service-role client within the same request; on failure, return 500,
  no partial-draft cleanup needed (draft row fails loudly before picks exist).

**Edit path:** existing `PATCH /api/drafts/[id]` config editing gains the same
participants list handling **only while `status === 'pending'`**; once started, seats
and order are frozen (rename of a name-seat remains possible post-start via the start
modal path; see §4).

### 4. Start flow (draft start modal + start route)

`DraftStartModal` and `POST /api/drafts/[id]/start`:

- For a `roster` draft, the modal shows the pre-created seats in `draft_position`
  order with up/down reorder arrows (this re-sends `positions`, which the start route
  already consumes to persist `draft_position`). Skip if the typed order is already
  right — the common case.
- `pick_entry_mode` is forced to `'admin_only'`; the self-draft option is hidden.
- Timers: available as today (optional `pick_timer_seconds`).
- The placeholder `__admin__` slot logic in the start route fires only for invite
  drafts; for roster drafts the positions array references real participant IDs, and
  the route skips creating a new admin participant if the admin has a seat or never
  wants one.
- **Rename during setup:** the modal allows editing a name-seat's `team_name`
  pre-start (a small pen icon). Post-start renames are out of scope.

### 5. Live draft room (enhance `/draft`)

`/draft` gains a "bound draft" mode, detected via a `?draft=<id>` query param (the
dashboard's start-success redirect and the draft card both link here). Behavior:

- **Load:** fetch the draft, participants (ordered by `draft_position`), and existing
  picks; build the same `DraftState` shape `coach/page.tsx` already builds in
  `mapToLegacyDraftState` (managers count = participant count, manager names = team
  names, `yourParticipantId` = the seat marked `is_you` or the admin's participant).
  Existing picks replay through `mapToLegacyDraftState` so coach/stack logic works
  mid-draft.
- **Pick entry:** clicking an available player calls the **existing**
  `POST /api/drafts/[id]/picks` with `participant_id` = the seat currently "on the
  clock" derived from the draft's `current_round`/`current_pick` (the API already
  computes `pick_number` and enforces whose turn it is). A "Picking now" selector is
  NOT needed — the API's turn enforcement makes the clock authoritative, which also
  keeps undo simple (see below).
- In `admin_only` mode the picks route already gates to admins only, so binding a
  host-only draft to `/draft` requires no new authorization logic.
- **Coach / Best Available / Stack tabs** all read the same state; no changes.
- **Undo:** new `DELETE /api/drafts/[id]/picks/last` — deletes the highest
  `pick_number` pick, decrements `current_round`/`current_pick` back to the deleted
  pick's slot, admin-gated, `admin_only` mode only. Complements the existing
  "replace pick" endpoint for room-driven use.
- **Standalone behavior preserved:** with no `?draft=` param, `/draft` behaves exactly
  as today (browser state, no persistence). The config panel keeps its manager count /
  pick order UI for this path.
- **On complete:** when picks reach `managers × players_per_team`, show a "Finish
  draft" button that calls the existing complete endpoint (the one the live page uses),
  then redirects to the draft dashboard.

### 6. Post-draft

- **Dashboard — whose roster is "yours"?** `GET /api/dashboard` currently keys the
  personal-roster panel on the caller's own participant. For roster drafts the rule is:
  use the caller's account-backed seat when one exists; otherwise return
  `myRosterResolved: 'none'` and render the draft-wide view (standings + tonight's
  games + roster browser) **without** a personal-roster panel — never guess a seat.
  The dashboard page offers a one-time admin-only "This is my team" bind: pick a name
  seat, and a new `POST /api/drafts/[id]/participants/claim` writes the caller's
  `user_id` onto it. One-way, admin-gated, safe because the caller must already be the
  draft admin.
- **Standings/scores:** all keyed on `participant_id` — already name-agnostic.
  Standings' elimination logic (already season-aware) treats every seat identically;
  no change needed.
- **Coach history:** works because picks persist; no change.

### 7. Scope boundaries (not building)

- No join/claim flow for OTHER users into name seats (only admin can claim one for
  themselves, §6).
- No per-seat payment/has_paid handling for name seats (`has_paid` stays false/null;
  verify during implementation whether the dashboard's payment UI renders for NULL-user
  seats, and gate it if so).
- No emails or invite objects touched.
- No separate "host draft room" page — `/draft` is the room.
- No free-form per-team slot assignment — typed order, reorderable at start.

## Testing

- **tsx suites** (app-level, matching repo convention):
  - `test-roster-participants.ts`: name-list normalization (trim, dedupe, min/max),
    payload shaping for create + start.
  - `test-bind-draft-state.ts`: participants + picks → `DraftState` mapping incl.
    replay of partial drafts, `yourParticipantId` resolution, snake clock derivation.
- **API routes:** exercised via the dev server during manual pass; no harness exists
  for Next route handlers in this repo (matches how all prior route work was tested).
- **Manual pass script:** create roster draft (seat me on/off) → start (reorder ONCE to
  prove it persists) → enter 6 picks on `/draft` bound mode → undo 1 → complete →
  dashboard shows standings + "your roster" (or draft-wide view when unclaimed) →
  verify picks + pick_numbers in Supabase.
- **Existing suites stay green:** 121 pytest (scraper), 6 tsx app suites, `tsc`, lint.

## Migration/rollout notes

- Single forward migration; no data backfill needed (`participant_mode` defaults to
  `'invite'`, existing drafts unaffected).
- Rollback = restoring `user_id NOT NULL`; only roster-mode drafts create NULL rows, so
  an invite-mode-only deployment window is safe.
