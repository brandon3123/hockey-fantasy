# Host-Only Roster Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin create a hosted draft whose participants are typed-in names (no accounts, no invites), run the draft solo through `/draft` with persistence, and get the full post-draft machinery.

**Architecture:** One migration makes participants account-optional (`user_id` nullable, unique per team name) and adds `drafts.participant_mode`. Creation writes seats up front; start forces `admin_only`; `/draft` gains a bound mode hydrated from Supabase through a shared state-mapping lib; dashboard resolves "your roster" from the caller's seat or renders draft-wide. Pick entry, undo, realtime, and auto-complete reuse existing endpoints unchanged.

**Tech Stack:** Next.js App Router, Supabase (anon + service-role clients), tsx check scripts for pure logic (repo convention; no JS test framework).

**Spec:** `docs/superpowers/specs/2026-09-26-host-only-rosters-design.md`

## Spec corrections found while planning (binding)

1. **Undo endpoint already exists** — `DELETE /api/drafts/[id]/picks/last` (admin-gated, decrements clock). Reuse; do not create it.
2. **Draft auto-complete already exists** — `POST /api/drafts/[id]/picks` sets `status='complete'` when the last pick lands (route lines 141-152). No "Finish draft" button.
3. **No RLS change needed** — the `004_fix_participant_rls.sql` policy already shows admins all participants of their drafts (including NULL-user seats). Skip the spec's policy rewrite.
4. **Seat order contradiction resolved:** the admin's own seat (when "seat me" is on) is **last** (`draft_position = typed count + 1`), matching the create-form bullet.

## Global Constraints

- Never commit data artifacts: `app/public/players.json`, `rankings.json`, `teams.json`, `lines_*.json`, `scraper/**/*.csv` stay unstaged.
- Every task ends green: `npx tsc --noEmit` clean, `npm run lint` zero `"  Error:"` lines, all `scripts/test-*.ts` suites pass (`npx tsx scripts/<name>.ts`).
- Follow existing patterns: admin actions via `getIsAdmin(user.id)` + service-role `createServerClient` with the empty-cookie shim; dark theme classes (`bg-[#0a0f0a]`, `text-[#c8d9c3]`, border `[#141e12]`).
- No new npm dependencies.
- Route files touched: mirror existing structure exactly (`src/app/api/drafts/...`).

## Review Focus

1. **Duplicate team name in one draft** → rejected with a readable message (client pre-check + DB unique index backstop), never two seats silently.
2. **"Seat me" OFF → start must not fabricate an admin seat**; dashboard renders draft-wide view with no personal panel and no crash (`myParticipant` undefined path).
3. **Turn enforcement with name seats** — `managers` count comes from participant row count (picks route lines 89-95, already correct); pick 1.1 by seat 1 succeeds, pick 1.1 by seat 2 → `400 'Not your turn'`.
4. **Undo across a round boundary** (2.1 → last pick of round 1) — clock must return to `(1, managers)`, not `(1, 1)`; existing `picks/last` logic handles it, verify in the manual pass.
5. **Non-admin click in bound `/draft`** → API 403 surfaces via alert and `refresh()` re-syncs; the board never silently drops a pick.

---

### Task 1: Migration — nullable `user_id`, team-name uniqueness, `participant_mode`

**Files:**
- Create: `supabase/migrations/008_host_only_participants.sql`

**Interfaces:**
- Produces: `draft_participants.user_id` nullable; `UNIQUE(draft_id, team_name)`; `drafts.participant_mode TEXT NOT NULL DEFAULT 'invite'` with CHECK in `('invite','roster')`. All later tasks assume these.

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE draft_participants ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE draft_participants DROP CONSTRAINT draft_participants_draft_id_user_id_key;
ALTER TABLE draft_participants ADD CONSTRAINT draft_participants_draft_id_team_name_key UNIQUE (draft_id, team_name);
CREATE INDEX draft_participants_draft_id_position_idx ON draft_participants (draft_id, draft_position);
ALTER TABLE drafts ADD COLUMN participant_mode TEXT NOT NULL DEFAULT 'invite'
  CHECK (participant_mode IN ('invite', 'roster'));
```

- [ ] **Step 2: Apply** via Supabase SQL editor or `supabase db push` (whichever the project uses; migrations here are plain SQL files applied manually — `001`–`007` precedent).

- [ ] **Step 3: Verify** — throwaway probe (delete after):

```ts
// npx tsx scripts/_tmp_migration_check.ts  (run from app/)
// service-role client; expect: participant_mode defaults exist, insert of a
// NULL-user participant succeeds, duplicate team_name fails, then rollback deletes it.
```

- Confirm `select participant_mode, count(*) from drafts group by 1` runs and existing draft shows `'invite'`.
- Confirm `insert into draft_participants (draft_id, team_name) values ('<existing>', 'Probe Seat')` succeeds, a second identical insert fails with unique violation, then delete the probe row.

- [ ] **Step 4: Delete the probe script and commit**

```bash
git add supabase/migrations/008_host_only_participants.sql
git commit -m "db: nullable participant users, team-name uniqueness, participant_mode"
```

---

### Task 2: Roster-participant helpers (pure, TDD)

**Files:**
- Create: `app/src/lib/roster-participants.ts`
- Test: `app/scripts/test-roster-participants.ts`

**Interfaces:**
- Produces:
  - `normalizeRosterNames(names: string[]): { ok: true; names: string[] } | { ok: false; error: string }` — trims, drops empties, rejects duplicates case-insensitively, enforces 2–20 names. Exact error strings: `'At least 2 team names required'`, `'At most 20 team names allowed'`, `` `Duplicate team name: ${name}` ``.
  - `buildParticipantRows(names: string[], opts: { draftId: string; adminUserId: string; seatMe: boolean; myName?: string }): Array<{ draft_id: string; user_id: string | null; team_name: string; draft_position: number }>` — admin seat LAST when `seatMe` (position `names.length + 1`, `user_id: adminUserId`, `team_name: myName?.trim() || 'Commissioner'`), typed names get `user_id: null` and positions `1..n` in order.

- [ ] **Step 1: Write the failing test** — `test-roster-participants.ts` checks: trim + drop-empty; duplicate (case-insensitive) rejected with exact message; 1 name → error; 21 names → error; exactly 20 → ok; `buildParticipantRows` seats admin last with position n+1 and typed names 1..n with `user_id: null`; `seatMe: false` yields only the typed rows.

- [ ] **Step 2: Run** `npx tsx scripts/test-roster-participants.ts` — expect FAIL (`Cannot find module '../src/lib/roster-participants'`).

- [ ] **Step 3: Implement** both functions in `roster-participants.ts`.

- [ ] **Step 4: Run** — expect ALL CHECKS PASSED.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/roster-participants.ts app/scripts/test-roster-participants.ts
git commit -m "feat: roster-participant name validation and seat builder"
```

---

### Task 3: `POST /api/drafts` creates seats in roster mode

**Files:**
- Modify: `app/src/app/api/drafts/route.ts` (body destructure lines 97-110; insert lines 121-139)

**Interfaces:**
- Consumes: `normalizeRosterNames`, `buildParticipantRows` from Task 2.
- Produces: `POST /api/drafts` accepts `participant_mode: 'invite' | 'roster'`, `participants?: string[]`, `seat_me?: boolean`, `my_name?: string`. Roster mode inserts the draft with `participant_mode: 'roster'` then seats via service-role client; validation failure → `400 { error }` before any insert.

- [ ] **Step 1: Add `participant_mode` to the select in `GET` handlers** (lines 17, 36, 49) so the form can read it when editing.

- [ ] **Step 2: Implement roster branch in `POST`** — destructure the new fields; if `participant_mode === 'roster'`: run `normalizeRosterNames` (400 on `!ok`), insert draft with `participant_mode: 'roster'`, then `buildParticipantRows(...)` rows via the existing `adminClient` service-role pattern (this file doesn't have one yet — create it exactly like `participants/route.ts` lines 31-40). Invite mode: ignore the new fields, store `participant_mode: 'invite'`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; manual: `curl`/browser create a roster draft, confirm seats exist with correct `draft_position` and one `user_id`-null row set (probe query from Task 1, then delete).

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/drafts/route.ts
git commit -m "feat: create-draft API seats typed participants in roster mode"
```

---

### Task 4: Create-form UI — mode toggle + name editor

**Files:**
- Modify: `app/src/components/DraftSetupForm.tsx` (state lines 31-42, payload lines 51-64, Season Type select lines 105-108, insert new section after the Draft Details card ~line 137)

**Interfaces:**
- Consumes: payload contract from Task 3.
- Produces: form submits `participant_mode`, `participants` (string[]), `seat_me`, `my_name`. Editing an invite draft is unchanged (`initialData?.participant_mode` respected, toggle hidden while `isEditing`).

- [ ] **Step 1: Add state** — `participantMode` (`'invite' | 'roster'`, default `'invite'` or `initialData?.participant_mode`), `rosterNames: string[]` (start `['', '']`), `seatMe` (default `true`), `myName` (default `''`).

- [ ] **Step 2: Render** — a segmented toggle under Season Type; when `roster`: name rows (input + remove button each, add-row button, up/down arrow buttons), the seat-me checkbox, and a `myName` input shown only when seat-me is on. Client-side dupe/empty checks surfaced inline (reuse `normalizeRosterNames` in `handleSubmit` to produce the payload; on `!ok` set form error and stop).

- [ ] **Step 3: Extend payload** in `handleSubmit` with the four new fields (roster names passed even if empty for invite mode; API ignores them).

- [ ] **Step 4: Verify** — `npx tsc --noEmit`, lint clean; manual: create flow with 3 names + seat-me on → dashboard page shows the typed teams; duplicates blocked inline.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/DraftSetupForm.tsx
git commit -m "feat: in-room participant editor on the create-draft form"
```

---

### Task 5: Start modal + start route for roster drafts

**Files:**
- Modify: `app/src/components/DraftStartModal.tsx` (props lines 7-13, mode state line 26, mode select in render)
- Modify: `app/src/app/api/drafts/[id]/start/route.ts` (draft select line 30-31, admin-participant creation lines 71-86, mode validation lines 47-49, update lines 118-127)
- Modify: `app/src/app/dashboard/drafts/[id]/page.tsx` (pass `participant_mode` to the modal, ~line 295 context)

**Interfaces:**
- Consumes: `drafts.participant_mode` (Task 1).
- Produces: `DraftStartModal` accepts optional `participantMode?: 'invite' | 'roster'` (default `'invite'`): roster mode hides the self-draft option (forces `admin_only`), hides randomize, and makes each seat name editable inline (rename → `team_name` update sent via a new optional `renames: Record<participant_id, string>` in the start body). Start route: adds `participant_mode` to its draft select; forces effective `pick_entry_mode` to `'admin_only'` for roster drafts regardless of body; skips the auto-create-admin-participant block (lines 71-86) entirely for roster drafts; applies `renames` (service-role update, unique-violation → 400 `'Team name already in use'`).

- [ ] **Step 1: Start route changes** — as above; keep the `__admin__` placeholder block (line 88-98) untouched; it only fires for invite drafts because roster positions never contain it.

- [ ] **Step 2: Modal changes** — as above; rename inputs initialize from `team_name`.

- [ ] **Step 3: Dashboard page** — pass `participantMode={draft.participant_mode}`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`, lint; manual: roster draft start → order persisted, renamed seat updated, no phantom `'Commissioner'` seat when seat-me off, `pick_entry_mode` stored as `admin_only` even if tampered body sends `self_draft`.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/DraftStartModal.tsx 'app/src/app/api/drafts/[id]/start/route.ts' app/src/app/dashboard/drafts/\[id\]/page.tsx
git commit -m "feat: roster-draft start flow (forced admin_only, seat renames)"
```

---

### Task 6: Extract `toLegacyDraftState` (pure, TDD)

**Files:**
- Create: `app/src/lib/bind-draft-state.ts`
- Test: `app/scripts/test-bind-draft-state.ts`
- Modify: `app/src/app/draft/[id]/coach/page.tsx` (delete local `mapToLegacyDraftState` lines 19-44, import from lib)

**Interfaces:**
- Produces: `toLegacyDraftState(draft: { players_per_team: number; current_round: number; current_pick: number }, participants: Array<{ id: string; team_name: string; draft_position: number | null }>, picks: Array<{ player_id: string; player_name: string; round: number; participant_id: string }>, availablePlayers: Player[], adminPosition: number, adminParticipantId: string): DraftState` — identical behavior to the coach page's `mapToLegacyDraftState` (managers = participants.length; picks replayed in given order; `yourParticipantId` = `adminParticipantId`).

- [ ] **Step 1: Write failing test** — `test-bind-draft-state.ts`: 2 participants + 1 pick → `managers: 2`, picks replayed, `currentRound`/`currentPick` passed through; NULL `draft_position` participants still counted; empty picks → empty picks array; names surface via a second exported helper `managerNamesFrom(participants): string[]` ordered by `draft_position` (nulls last, stable).

- [ ] **Step 2: Run** — expect FAIL (module not found).

- [ ] **Step 3: Implement** — move the function, add `managerNamesFrom`.

- [ ] **Step 4: Run** — ALL CHECKS PASSED; `npx tsc --noEmit` clean (coach page compiles against the lib import).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/bind-draft-state.ts app/scripts/test-bind-draft-state.ts 'app/src/app/draft/[id]/coach/page.tsx'
git commit -m "refactor: share draft-state binding helper, add manager-names derivation"
```

---

### Task 7: `/draft` bound mode (the draft room)

**Files:**
- Modify: `app/src/app/draft/page.tsx` (config state lines 29-31, `handleSetupDraft` 88-96, `handleDraftPlayer` 115-150, `handleUndoPick` 171-228, config panel inputs 330-389)

**Interfaces:**
- Consumes: `useDraftState(draftId)` (existing hook: draft, participants, picks, players, availablePlayers, refresh, isDraftComplete), `toLegacyDraftState` + `managerNamesFrom` (Task 6), existing `POST /api/drafts/[id]/picks` and `DELETE /api/drafts/[id]/picks/last`.
- Produces: `useBoundDraft()` internal hook in the same file — takes `draftId` (from `useSearchParams().get('draft')`), returns `{ legacyState, managerNames, bound: true, makePick, undoLast, loading }` or `bound: false` when no param. `makePick(player)` POSTs `participant_id` = seat at the on-clock position (participants ordered by `draft_position`, index = `getCurrentManager(legacyState) - 1`), then `refresh()`; non-OK → `alert(data.error)` + `refresh()`. `undoLast()` DELETEs last pick then `refresh()`.

- [ ] **Step 1: Implement `useBoundDraft`** — early-return `bound: false` while param absent; while loading show existing loading UI; when `draft.status === 'complete'` set `isDraftComplete` (reuse from hook). Read the param via `useSearchParams()` inside a `<Suspense>` wrapper (Next.js build fails otherwise: "useSearchParams() should be wrapped in a suspense boundary").

- [ ] **Step 2: Wire the page** — when bound: hide the config panel (managers/pick-order inputs lines 330-389), replace `handleDraftPlayer`/`handleUndoPick` with the bound versions (skip localStorage writes), render manager names from `managerNamesFrom`, show a "Bound to: {draft.name}" header chip linking to the dashboard, and on `isDraftComplete` show a link to the draft dashboard instead of the complete banner.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`, lint; manual: `/draft?draft=<id>` loads seats + any existing picks, pick a player → appears in Supabase after `refresh()`, undo works, second-manager turn enforcement error surfaces as alert; `/draft` without param unchanged (localStorage flow intact).

- [ ] **Step 4: Commit**

```bash
git add app/src/app/draft/page.tsx
git commit -m "feat: bind /draft to a hosted roster draft (write-through picks)"
```

---

### Task 8: Dashboard resolution, claim endpoint, payment gating

**Files:**
- Modify: `app/src/app/api/dashboard/route.ts` (early return lines 84-86)
- Create: `app/src/app/api/drafts/[id]/participants/claim/route.ts`
- Modify: `app/src/app/dashboard/drafts/[id]/page.tsx` (has_paid / payment UI gating; claim selector)

**Interfaces:**
- Produces: dashboard response gains `myRosterResolved: 'mine' | 'none'` — `'none'` when the caller has no seat (existing `myParticipant` undefined path now returns the full draft-wide payload with `roster: []` instead of the bare `{ draft, rank: null }` object). Claim endpoint: `POST /api/drafts/[id]/participants/claim` body `{ participant_id }` — `getIsAdmin` gated, seat must belong to the draft and have `user_id IS NULL`, sets `user_id = caller` (400 `'Seat already claimed'` if taken, `'Already have a seat in this draft'` if caller has one).

- [ ] **Step 1: Dashboard route** — replace the early return (lines 84-86) with the full payload minus personal roster; add `myRosterResolved` (also `'mine'` on the happy path).

- [ ] **Step 2: Claim route** — per contract above; mirror the service-role pattern from `start/route.ts`.

- [ ] **Step 3: Dashboard page** — payment/`has_paid` column: find where `has_paid` renders and gate rows without `user_id` out of payment UI (fetch already returns `user_id`). When `myRosterResolved === 'none'` and `isAdmin`: render the "This is my team" selector (name seats only) → claim → refetch. Personal-roster panel renders from the caller's seat as today once claimed.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`, lint, all `scripts/test-*.ts` suites; manual: unclaimed roster draft → draft-wide dashboard + claim flow → personal roster appears.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/dashboard/route.ts 'app/src/app/api/drafts/[id]/participants/claim/route.ts' app/src/app/dashboard/drafts/\[id\]/page.tsx
git commit -m "feat: draft-wide dashboard for roster drafts, admin seat claim"
```

---

### Task 9: Full verification sweep + manual pass

**Files:** none (verification only)

- [ ] **Step 1: Automated** — scraper `venv/bin/python -m pytest tests/` (121 pass), all app `scripts/test-*.ts` suites (including two new), `npx tsc --noEmit`, `npm run lint` zero errors.
- [ ] **Step 2: Manual pass (dev server)** — create roster draft (3 names, seat-me on, duplicate blocked once) → start with one rename + reorder → `/draft?draft=` enter 6 picks incl. a round-boundary undo → draft auto-completes on final pick → dashboard shows standings, personal roster (claimed seat), no red cross-outs, tonight's games in MT → confirm picks + `pick_number`s in Supabase.
- [ ] **Step 3: Push**

```bash
git push origin master
```
