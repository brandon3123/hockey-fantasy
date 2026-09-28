# Scoring Extensions: Defenseman Goal Bonus + Team Picks

**Date:** 2026-09-27
**Status:** Design approved in chat, pending spec review
**Author:** Brainstorm session with Brandon

## Problem

The draft scores only player goals and assists, in two fixed formats. Brandon wants:
1. An optional per-draft bonus: **defenseman goals score base + 1** (2 pts in the
   1pt/G+A format, 3 pts in 2G/1A; assists unaffected).
2. An optional per-draft mechanic: **a manager may spend one roster slot on an actual
   NHL team**. When enabled, team picks are **unique** (each NHL team draftable once by
   one manager) and **mandatory** — every manager needs at least one team among their
   picks.
3. Team picks score **1 point per win, 2 points for a shutout** (a shutout win is
   2 points total — the shutout replaces the win point, confirmed in chat).

## Decisions (from chat)

| Question | Decision |
|---|---|
| D-bonus shape | Per-draft **toggle**; base + 1 per D goal; assists unaffected |
| Team picks mandatory or optional | Toggle at config; **when ON: unique + mandatory (≥1 team per manager)** |
| Team pick occupies a roster slot? | Yes — "one of a manager's picks" (stated as assumption, accepted) |
| Shutout win value | **2 total** (not 3) — assumption stated in design, approved |
| Where enforced | Uniqueness by the existing pick-uniqueness check; mandatory at the completion moment |
| Where team results come from | The same nightly boxscore pass the cron already runs |

## Design

### 1. Config: two new draft columns

Migration `010_scoring_extensions.sql`:

```sql
ALTER TABLE drafts
  ADD COLUMN d_goal_bonus BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN team_picks_enabled BOOLEAN NOT NULL DEFAULT false;
```

- Both default `false`; existing drafts unaffected.
- Editable pre-start and after start? **Pre-start only** — flip either mid-draft and
  historical scores become ambiguous. Added to the PATCH `allowedFields` — wait, no:
  these MUST be changeable pre-start only. The PATCH route is used for pre-start
  config editing only (status `setup`), so simply adding them to `allowedFields` is
  correct; no gating needed beyond what exists.

**Create form** (`DraftSetupForm.tsx`): two checkboxes in the Draft Details card next
to Scoring Format:

- "Defenseman goals +1 pt" → `d_goal_bonus`
- "Include team picks (1 pt/win, 2 pts/shutout)" → `team_picks_enabled`

Both included in the payload always (booleans); defaults false.

### 2. Scoring: one shared pure lib

New `app/src/lib/scoring.ts`:

```ts
computePlayerPoints(goals: number, assists: number, opts: {
  scoringFormat: '1pt_per_goal_assist' | '2pt_goals_1pt_assists';
  isDefenseman: boolean;
  dGoalBonus: boolean;
}): { points: number; goals: number; assists: number }

computeTeamPoints(winner: boolean, shutout: boolean): number
// winner only → 1; winner + shutout → 2; otherwise 0
```

`computePlayerPoints`: base = format math (G×2+A, or G+A); when `dGoalBonus` and
`isDefenseman`, add `goals` (each D goal +1). This is the single definition of player
scoring — all three write paths call it:

- **Cron** (`/api/cron/update-scores`): has `draft.scoring_format`, `d_goal_bonus`,
  `team_picks_enabled` from the draft row; the player's position comes from the
  boxscore's `positionCode` ('D') or the players-table lookup (already present).
- **Manual entry** (`PATCH /api/drafts/[id]/scores`): looks up the player's position
  from the `players` table (new small query) + the draft's toggles.
- **Backfill** (`/api/drafts/[id]/backfill`): same inputs as cron.

The old inline format math in all three routes is replaced by the lib call.

### 3. Team pick scoring (cron)

When `draft.team_picks_enabled`:

- For each completed game processed by the cron, derive team results from the
  boxscore: winner = team with more goals; shutout = the losing team scored 0.
- For each roster seat that owns a team pick (`draft_picks.player_id = 'team-{abbrev}'`),
  upsert a `player_scores` row: `player_id: 'team-edm'`, `score_date` = game date,
  `goals: 0`, `assists: 0`, `points: computeTeamPoints(...)`.
- Upsert conflict key is unchanged (`player_id, draft_id, score_date`) — a team can
  play only once per date, so one row per team per day is correct.
- If neither owner nor any pick owns that NHL team, write nothing (no rows for
  unowned teams — standings only reflect owned teams).
- Team picks whose game hasn't happened yet: nothing to do; points accrue on game
  nights.

### 4. Drafting a team (UI, when `team_picks_enabled`)

- **Pickable entries:** the player sources gain team entries — 32 rows shaped like
  players: `name: 'Edmonton Oilers'`, `player_id: 'team-edm'`, `position: 'TEAM'`.
  Constructed client-side (a lib helper `teamPickEntries(): Player[]`-shaped rows);
  NOT added to the `players` table (teams aren't players).
- **Surfaces:** `/draft` standalone is NOT included (no scoring there; team picks only
  exist for hosted drafts with the toggle). The bound `/draft?draft=` room, the live
  page sidebar, and the coach page render a "Teams" section (grid of 32 team cards:
  logo + name) above/beside the player list when the toggle is on. Clicking a team
  card = the normal pick flow (`POST /picks` with `player_id: 'team-edm'`,
  `player_name: 'Edmonton Oilers'`).
- **Uniqueness:** the picks route's existing `existingPick` check (by `player_id`)
  rejects a second draft of the same team (`409 Player already drafted`) — no new code.
- **At most one team per manager:** the picks API rejects a `team-%` pick from a
  participant who already owns one (`400 'Manager already has a team pick'`). This
  matches "one of a manager's picks can be a team" and keeps the mandatory rule
  satisfiable.
- **Slot accounting:** a team pick consumes one of the manager's `players_per_team`
  slots — it IS a pick; nothing special-cased.
- **Mandatory ≥1 per manager:** enforced at the completion moment. The picks route's
  completion branch (last pick → status complete) first checks: when
  `team_picks_enabled`, every participant must own at least one `team-%` pick. If not,
  return `400 'Every manager needs a team pick'` and do NOT complete — the manager
  fixes it by replacing a late player pick with a team (replace/undo flows unchanged).
- **Rendering picked teams:** anywhere picks render (grid cells, rosters, standings
  roster panels), a `team-%` pick renders as a team-logo tile with position "TEAM";
  no line-stack or injury logic applies (guards by id prefix).

### 5. Not building

- Trading team picks between managers.
- More than one team pick per manager (enforced at pick time, §4).
- Different team scoring in playoffs mode (wins/shutouts apply in any season type).
- Team picks in the standalone `/draft` (no scoring exists there).

### 6. Testing

- **`app/scripts/test-scoring.ts`** (tsx, TDD): `computePlayerPoints` — both formats ×
  D/non-D × bonus on/off; `computeTeamPoints` — win/shutout/loss; `teamPickEntries`
  shape (32 entries, unique ids).
- **Routes:** thin wrappers over the lib (repo convention: manual verification);
  manual pass = create a draft with both toggles → draft a team → enter a win and a
  shutout manually → standings show 1 and 2 → cron pass on a real game day.
- **All existing suites stay green** (121 pytest, 9+ tsx suites, tsc, lint).

### 7. Rollout

- One forward migration (010); no backfill — toggles default false.
- No deployment ordering constraints: the toggles are inert until used.
