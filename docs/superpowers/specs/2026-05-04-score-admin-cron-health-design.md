# Score Admin & Cron Health Log

## Date: 2026-05-04

## Overview

Post-draft admin tools for auditing and fixing player scoring data. Accessible only by the draft admin from the dashboard command center when draft status is `complete`. Gives visibility into cron health and manual control over score data.

## User Profile

- Draft admin who wants to verify scoring is correct during an active season/playoffs
- Needs to know if the daily cron ran successfully and caught all scores
- Needs to fix wrong scores or catch up missed days without touching the database directly

## Access Point

On the dashboard (`/`), when the admin's draft is `complete`, the command center header shows a **"Manage Scores"** button (gold/amber outline, same style as other secondary actions). This links to `/dashboard/drafts/[id]/scores`.

No "Back to Dashboard" links — navigation handles routing.

## Page Structure

Single page at `/dashboard/drafts/[id]/scores` with three tabs:

### Tab 1: Scores

Master score editor styled identically to the standings page — same grid, same expandable rosters, same medals/ranks. The difference is each player row has an **editable** G/A.

**Header:**
- Centered hero: "ADMIN" label, draft name, season type / managers / rounds

**Standings grid:**
- Same layout as `/draft/[id]/standings`: rank (#), team name, PTS, yesterday badge, GB
- Click a team row to expand their roster
- Roster columns: round #, team logo, player name, **G**, **A**, PTS, action
- Team logos (via `TeamLogo` component) replace all text abbreviations
- Eliminated players: red strikethrough + dimmed (same as standings)
- Injured players: DTD/OUT badges (same as standings)

**Editing:**
- Each player row shows a ✎ pencil icon (green) in the action column
- Click ✎ to enter edit mode on that row — G and A become inline number inputs, PTS recalculates on save
- Edit mode shows ✓ (green, saves) and ✕ (red, cancels) buttons replacing the pencil
- On save: PATCH to API, updates the player's aggregate score, standings re-fetch
- Scoring format auto-applied: `1pt_per_goal_assist` → G+A, `2pt_goals_1pt_assists` → 2G+A

**No date filtering** — this is a master editor showing total G/A per player.

### Tab 2: Cron Log

Shows last 30 cron runs for this draft.

**Each run card shows:**
- Status dot: green (healthy), amber (warnings — unmatched players), red (errors)
- Date (monospace) + timestamp (MST)
- 4-column stat grid: Games found, Results found, Scores upserted, Emails sent
- Error/warning section (if any): unmatched player names in amber, API/upsert errors in red

**Legend at bottom:** green = healthy, amber = warnings, red = errors

### Tab 3: Backfill

Checkbox list of recent dates to re-run scoring. Replaces free-text date input.

**Date list:**
- Shows last 30 days (most recent first)
- Each row: checkbox, date (monospace), status from last cron run (score count in green, unmatched in amber, errors in red, "No run recorded" in red), day of week
- Dates with no cron run are highlighted as missed

**Action bar:**
- Selected count ("3 dates selected")
- "Run Backfill" button (green)

**Results section** (appears after running):
- Per-date result: status dot + date + scores upserted + games count
- Unmatched player names shown in amber below relevant dates
- Results also written to `cron_runs` table

## Data Sources

| Feature | Source |
|---------|--------|
| Standings + rosters | `GET /api/drafts/[id]/standings` (existing) |
| Score editing | `PATCH /api/drafts/[id]/scores` (new) |
| Cron log | `GET /api/drafts/[id]/cron-runs` (new) |
| Backfill execution | `POST /api/drafts/[id]/backfill` (new) |
| Backfill date list | `cron_runs` table joined with date range |
| Team logos | `TeamLogo` component (ESPN CDN) |

## New Database

### `cron_runs` table

```sql
CREATE TABLE cron_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  games_found INTEGER DEFAULT 0,
  results_found INTEGER DEFAULT 0,
  scores_upserted INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  ran_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: admin can view for their drafts, service role can insert.

## API Endpoints

### `PATCH /api/drafts/[id]/scores`

Admin-only. Updates a player's total score by replacing all their `player_scores` rows with a single aggregate row. Request body: `{ score_id, goals, assists }`. Points recalculated from scoring format.

**Implementation note:** Since we're doing a "master editor" (not per-date), the API needs to either:
- Option A: Delete all existing `player_scores` rows for that player+draft, insert a single row with the new totals
- Option B: Keep the existing per-date rows and just adjust the difference on the most recent date

Option A is simpler and more predictable. The admin is directly setting what the totals should be.

### `GET /api/drafts/[id]/cron-runs`

Admin-only. Returns last 30 `cron_runs` rows for this draft, ordered by `ran_at` desc.

### `POST /api/drafts/[id]/backfill`

Admin-only. Takes `{ dates: string[] }`. For each date, fetches completed games from NHL API, matches to draft picks, upserts `player_scores`, and inserts a `cron_runs` row. Returns per-date results.

## Cron Handler Changes

The existing `GET /api/cron/update-scores` route needs these changes:

1. **Insert `cron_runs` rows** — after processing each draft, log the run with games found, scores upserted, emails sent, and any errors
2. **Track unmatched names** — NHL boxscore players that don't match any draft pick. Store in `errors` array as `"Unmatched: Player Name"`
3. **Score `in_progress` drafts** — change draft query from `.eq('status', 'complete')` to `.in('status', ['complete', 'in_progress'])` so drafts get scored even during live drafting
4. **Emails still only for `complete`** — unchanged behavior, just scoring applies to both statuses

## Files to Create/Modify

### Create
- `supabase/migrations/006_cron_runs.sql`
- `app/src/app/api/drafts/[id]/scores/route.ts`
- `app/src/app/api/drafts/[id]/cron-runs/route.ts`
- `app/src/app/api/drafts/[id]/backfill/route.ts`
- `app/src/app/dashboard/drafts/[id]/scores/page.tsx`

### Modify
- `app/src/app/api/cron/update-scores/route.ts` — log cron runs, track unmatched, score in-progress drafts
- `app/src/app/page.tsx` — add "Manage Scores" button to command center header (admin-only, complete status only)
