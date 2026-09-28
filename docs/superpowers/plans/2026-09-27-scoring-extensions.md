# Scoring Extensions (D-Goal Bonus + Team Picks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two per-draft toggles — defenseman goals +1 pt, and draftable NHL teams scoring 1 pt per win / 2 per shutout (unique, one per manager, mandatory by completion).

**Architecture:** One migration adds `drafts.d_goal_bonus` and `drafts.team_picks_enabled`. All player-points math collapses into one pure lib (`computePlayerPoints`) called by the three scoring paths (cron, manual entry, backfill); team results derive from the schedule's game scores the cron already fetches, stored as `team-{abbrev}` rows in `player_scores`. Team picks are normal picks with `player_id: 'team-{abbrev}'` — existing uniqueness covers league-wide uniqueness; two new API guards cover one-per-manager and mandatory-by-completion; the drafting surfaces render team entries when toggled on.

**Tech Stack:** Next.js App Router, Supabase, tsx check scripts (repo convention; no JS test framework).

**Spec:** `docs/superpowers/specs/2026-09-27-scoring-extensions-design.md`

## Global Constraints

- Never commit data artifacts: `app/public/players.json`, `rankings.json`, `teams.json`, `lines_*.json`, `scraper/**/*.csv` stay unstaged.
- Every task ends green: `npx tsc --noEmit` clean, `npm run lint` zero `"  Error:"` lines, all `app/scripts/test-*.ts` suites pass.
- Exact point values (spec): base formats G+A or 2G+1A; D bonus = **+1 per D goal** when toggled; team = **win 1, shutout 2 total**.
- Team pick id convention: **`team-{abbrev}` lowercase** (e.g. `team-edm`); display position string: **`TEAM`**.
- No new npm dependencies. Follow existing route patterns (service-role client with empty-cookie shim; `getIsAdmin` gating).

## Review Focus

1. **A defenseman's goal under each format × toggle** — 1pt format: 2 with bonus, 1 without; 2G/1A: 3 with, 2 without; assists NEVER affected. Pinned by `test-scoring.ts` (Task 2).
2. **Shutout math** — shutout win = **2 total** (not 3); 1-0 win = 1; loss = 0. Pinned by `test-scoring.ts` (Task 2).
3. **Team-pick guards** — second team by the same manager → 400; same team by another manager → 409; team pick when toggle off → 400. Pinned in Task 5 verification (routes have no test harness; verified in the manual pass).
4. **Completion gate** — final pick with any manager missing a team → 400 and the draft does NOT complete; swapping that pick for a team then completes. Verified in the manual pass (Task 9).
5. **Toggle-off legacy behavior** — with both toggles off, every score path produces byte-identical results to today (no D bonus, no team rows). Pinned by `test-scoring.ts` (Task 2) + manual pass.

---

### Task 1: Migration — `d_goal_bonus` + `team_picks_enabled`

**Files:**
- Create: `supabase/migrations/010_scoring_extensions.sql`

**Interfaces:**
- Produces: `drafts.d_goal_bonus BOOLEAN NOT NULL DEFAULT false`, `drafts.team_picks_enabled BOOLEAN NOT NULL DEFAULT false`. All later tasks assume these.

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE drafts
  ADD COLUMN d_goal_bonus BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN team_picks_enabled BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Hand to Brandon** — he applies migrations manually (SQL editor). Wait for his confirmation before Task 3+ depend on the columns (Tasks 2, 5, 8 are safe to start; Tasks 3, 4, 5, 6 need the columns at runtime).

- [ ] **Step 3: Verify** — throwaway probe from `app/`: `select d_goal_bonus, team_picks_enabled from drafts limit 1` returns `false, false`; commit.

```bash
git add supabase/migrations/010_scoring_extensions.sql
git commit -m "db: d_goal_bonus and team_picks_enabled draft toggles"
```

---

### Task 2: Scoring lib (pure, TDD)

**Files:**
- Create: `app/src/lib/scoring.ts`
- Test: `app/scripts/test-scoring.ts`

**Interfaces:**
- Produces:
  - `computePlayerPoints(goals: number, assists: number, opts: { scoringFormat: string; isDefenseman: boolean; dGoalBonus: boolean }): number` — base: `2*goals + assists` when `scoringFormat === '2pt_goals_1pt_assists'`, else `goals + assists`; when `dGoalBonus && isDefenseman`, add `goals`.
  - `computeTeamPoints(won: boolean, shutout: boolean): number` — `2` if won && shutout, `1` if won, else `0`.
  - `isTeamPick(playerId: string): boolean` — true when `playerId` starts with `'team-'`.
  - `teamAbbrevFromPick(playerId: string): string` — `'team-edm'` → `'EDM'` (uppercase), else `''`.

- [ ] **Step 1: Write the failing test** — `test-scoring.ts` asserts, with exact numbers:
  - `computePlayerPoints(1, 0, { scoringFormat: '1pt_per_goal_assist', isDefenseman: true, dGoalBonus: true }) === 2`
  - same with `isDefenseman: false` → `1` (skater goal unaffected)
  - same with `dGoalBonus: false` → `1` (toggle off = today's behavior)
  - `computePlayerPoints(1, 0, { scoringFormat: '2pt_goals_1pt_assists', isDefenseman: true, dGoalBonus: true }) === 3`
  - `computePlayerPoints(0, 2, { scoringFormat: '2pt_goals_1pt_assists', isDefenseman: true, dGoalBonus: true }) === 2` (assists NEVER affected)
  - `computePlayerPoints(2, 1, { scoringFormat: '1pt_per_goal_assist', isDefenseman: true, dGoalBonus: true }) === 5` (both goals are D goals: 2+2+1)
  - `computeTeamPoints(true, true) === 2`; `computeTeamPoints(true, false) === 1`; `computeTeamPoints(false, false) === 0`; `computeTeamPoints(false, true) === 0` (a shutout loss scores nothing)
  - `isTeamPick('team-edm') === true`; `isTeamPick('connor-mcdavid-edm-c') === false`
  - `teamAbbrevFromPick('team-edm') === 'EDM'`; `teamAbbrevFromPick('connor-mcdavid-edm-c') === ''`

- [ ] **Step 2: Run** `npx tsx scripts/test-scoring.ts` — expect FAIL (`Cannot find module '../src/lib/scoring'`).

- [ ] **Step 3: Implement** the four functions in `app/src/lib/scoring.ts`.

- [ ] **Step 4: Run** — expect ALL CHECKS PASSED.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/scoring.ts app/scripts/test-scoring.ts
git commit -m "feat: shared scoring lib — player points with D bonus, team points"
```

---

### Task 3: Cron — wire the lib + team scoring

**Files:**
- Modify: `app/src/app/api/cron/update-scores/route.ts` (draft selects lines 40 and 158 — add `d_goal_bonus, team_picks_enabled`; points math lines 121-127 → `computePlayerPoints`; team scoring after the player loop)

**Interfaces:**
- Consumes: `computePlayerPoints`, `computeTeamPoints`, `isTeamPick` (Task 2); `TonightGame.awayScore/homeScore` (already on `ScheduleGame`, Task 3 confirms they flow through `fetchCompletedGames`).
- Produces: cron writes player rows via the lib; when `team_picks_enabled`, also upserts `team-{abbrev}` rows into `player_scores` (same conflict key `player_id,draft_id,score_date`).

- [ ] **Step 1: Extend `TonightGame`/`mapGame` in `src/lib/nhl-api.ts`** to carry `awayScore?: number; homeScore?: number` from `ScheduleGame` (fields already exist on the interface — confirm they're populated by the schedule response; map them in `mapGame`).

- [ ] **Step 2: Cron player scoring** — replace the inline ternary (lines 121-127) with `computePlayerPoints(result.goals, result.assists, { scoringFormat: draft.scoring_format, isDefenseman: result.positionCode === 'D', dGoalBonus: !!draft.d_goal_bonus })`. The boxscore rows carry `positionCode` — extend `PlayerGameResult` (and `fetchGameResults`) to include it if not already present.

- [ ] **Step 3: Cron team scoring** — after the player loop, only when `draft.team_picks_enabled`: for each completed game with numeric scores, `won`/`shutout` per side via `computeTeamPoints`; find picks where `player_id = 'team-' + abbrev.toLowerCase()`; upsert one `player_scores` row per owned team (`goals: 0, assists: 0, points`), same conflict key. No rows for unowned teams.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`, lint, all suites; manual cron run (`POST`/GET the cron route with CRON_ENABLED or the admin trigger) against a day with final scores.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/cron/update-scores/route.ts app/src/lib/nhl-api.ts
git commit -m "feat: cron scores D-bonus players and owned team picks"
```

---

### Task 4: Manual entry + backfill — wire the lib

**Files:**
- Modify: `app/src/app/api/drafts/[id]/scores/route.ts` (draft select line 16 — add `d_goal_bonus`; points math line 26 → `computePlayerPoints` with position from a new players lookup)
- Modify: `app/src/app/api/drafts/[id]/backfill/route.ts` (draft select line 17 — add `d_goal_bonus, team_picks_enabled`; points math lines 74-75 → `computePlayerPoints` with position from the players query)

**Interfaces:**
- Consumes: `computePlayerPoints`, `isTeamPick` (Task 2).
- Produces: manual entry rejects team ids (`400 'Team picks score automatically'`); backfill handles D-bonus via position from the players table.

- [ ] **Step 1: Manual entry** — reject `isTeamPick(player_id)` when toggle off or on (manual goals/assists make no sense for teams); look up the pick's player position (`players` table by `player_id`) and score via the lib.

- [ ] **Step 2: Backfill** — extend the players query (the one building `nhlIdToName`) to include `position`; score via the lib with `dGoalBonus: !!draft.d_goal_bonus`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit`, lint, suites; manual: enter a D goal for a defenseman with the bonus on → 2 pts in the 1pt format.

- [ ] **Step 4: Commit**

```bash
git add "app/src/app/api/drafts/[id]/scores/route.ts" "app/src/app/api/drafts/[id]/backfill/route.ts"
git commit -m "feat: manual entry and backfill score through the shared lib"
```

---

### Task 5: Picks API — team-pick rules

**Files:**
- Modify: `app/src/app/api/drafts/[id]/picks/route.ts` (after the `existingPick` 409 check, lines 55-64; draft select line 36 — add `team_picks_enabled`; completion branch lines 138-152)

**Interfaces:**
- Consumes: `isTeamPick` (Task 2).
- Produces: three new guards + the completion gate:
  1. `isTeamPick(player_id) && !draft.team_picks_enabled` → `400 'Team picks are not enabled for this draft'`.
  2. `isTeamPick(player_id)` and the participant already owns a `team-%` pick → `400 'Manager already has a team pick'`.
  3. Completion branch: when `draft.team_picks_enabled` and any participant owns no `team-%` pick → `400 'Every manager needs a team pick'` and do NOT set `status: 'complete'` (the clock does not advance; the manager replaces a late player pick with a team).

- [ ] **Step 1: Implement** the three guards (guard 3 in the completion branch before the status update; check via one query for picks with `player_id.like('team-%')` grouped by `participant_id`).

- [ ] **Step 2: Verify** — `npx tsc --noEmit`, lint, suites; manual pass in Task 9 exercises all three rejections + the success path.

- [ ] **Step 3: Commit**

```bash
git add "app/src/app/api/drafts/[id]/picks/route.ts"
git commit -m "feat: team-pick guards — enabled gate, one per manager, mandatory at completion"
```

---

### Task 6: Config plumbing (form + create + PATCH)

**Files:**
- Modify: `app/src/components/DraftSetupForm.tsx` (state block ~lines 31-42; payload ~lines 51-70; checkboxes UI next to Scoring Format ~line 112)
- Modify: `app/src/app/api/drafts/route.ts` (create: destructure + insert the two new fields)
- Modify: `app/src/app/api/drafts/[id]/route.ts` (PATCH `allowedFields` += both)

**Interfaces:**
- Produces: create/edit payloads carry `d_goal_bonus: boolean`, `team_picks_enabled: boolean` (always sent, default false). The dashboard detail page's edit form `initialData` passes both through.

- [ ] **Step 1: Form** — two checkboxes under Scoring Format ("Defenseman goals +1 pt", "Include team picks (1 pt/win, 2 pts/shutout)"); state + payload.
- [ ] **Step 2: Create API** — destructure + insert (`!!body.d_goal_bonus` etc.).
- [ ] **Step 3: PATCH** — add both to `allowedFields`; the detail page passes them into the edit form's `initialData`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit`, lint; manual: create with both on → DB row true/true; edit toggles pre-start → persists.
- [ ] **Step 5: Commit**

```bash
git add app/src/components/DraftSetupForm.tsx app/src/app/api/drafts/route.ts "app/src/app/api/drafts/[id]/route.ts" "app/src/app/dashboard/drafts/[id]/page.tsx"
git commit -m "feat: draft config toggles for D-goal bonus and team picks"
```

---

### Task 7: Team entries in the drafting surfaces

**Files:**
- Create: `app/src/lib/team-picks.ts`
- Test: `app/scripts/test-team-picks.ts`
- Modify: `app/src/app/draft/page.tsx` (bound room tabs), `app/src/app/draft/[id]/live/page.tsx` (sidebar), `app/src/app/draft/[id]/coach/page.tsx` — merge team entries into the lists when the bound/live draft has `team_picks_enabled`

**Interfaces:**
- Produces: `teamPickEntries(): Array<{ playerId: string; playerName: string; team: string; position: 'TEAM'; displayPoints: 0; displayGames: 0 }>` — 32 entries (`team-ana` … `team-wsh`, city names). Consumers spread them into the player lists when `draft.team_picks_enabled` is true.
- Rendering: any pick whose `player_id` passes `isTeamPick` renders as a team tile — `TeamLogo` with the abbrev from `teamAbbrevFromPick`, position label `TEAM`; no injury/stack logic (guard by prefix).

- [ ] **Step 1: Write the failing test** — 32 entries, unique ids, `team-edm` present with name 'Edmonton Oilers', every position === 'TEAM', `isTeamPick` agrees on every id.
- [ ] **Step 2: Run** — expect FAIL (module not found).
- [ ] **Step 3: Implement** `team-picks.ts` (city names + abbrevs static list; reuse the ESPN CDN logo URLs pattern from `TeamLogo`).
- [ ] **Step 4: Run** — ALL CHECKS PASSED.
- [ ] **Step 5: Wire surfaces** — in each of the three pages, `const entries = draft?.team_picks_enabled ? teamPickEntries() : []` merged ahead of `availablePlayers` where lists render; pick click flows through the existing handlers unchanged (the API guards apply). Grid/roster cells: when a pick's id `isTeamPick`, render `TeamLogo team={teamAbbrevFromPick(id)}` + label `TEAM`.
- [ ] **Step 6: Verify** — `npx tsc --noEmit`, lint, suites; manual: toggle on → draft a team from Best/All → unique + one-per-manager rejections fire → complete blocked until everyone has one.
- [ ] **Step 7: Commit**

```bash
git add app/src/lib/team-picks.ts app/scripts/test-team-picks.ts app/src/app/draft/page.tsx "app/src/app/draft/[id]/live/page.tsx" "app/src/app/draft/[id]/coach/page.tsx"
git commit -m "feat: draftable NHL teams in the drafting surfaces"
```

---

### Task 8: Full sweep + manual pass

**Files:** none

- [ ] **Step 1: Automated** — scraper pytest (121), all app tsx suites, `tsc`, lint.
- [ ] **Step 2: Manual pass** — create a draft with both toggles on → draft players + one team each (try: second team → 400; same team twice → 409) → complete blocked until every manager has a team → complete → enter a win (1 pt) and a shutout (2 pts) for owned teams → standings totals include them → D goal scores base+1 in both formats.
- [ ] **Step 3: Push**

```bash
git push origin master
```
