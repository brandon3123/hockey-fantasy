# Post-Draft Season Tracking Design

## Overview

After a draft completes and the season begins, the app tracks actual player performance (goals + assists) via nightly NHL API updates, displays live standings, shows tonight's games, and sends daily morning email recaps to all participants.

## Architecture

**Single cron job** fetches NHL results, writes `player_scores` rows, then sends emails via Resend. Standings are computed on the fly from `player_scores` — no denormalized totals table needed (~60K rows max per draft, aggregate queries are fast).

## Existing Infrastructure

- `player_scores` table already exists in the DB (migration 001)
- `resend` package already in `package.json`
- NHL Stats API is free, no auth required
- `scoring_format` field on `drafts` table (currently `1pt_per_goal_assist`)
- `TeamLogo` component handles all NHL team logos with ESPN CDN URLs

---

## 1. Nightly Cron Job

**API route:** `/api/cron/update-scores`
**Trigger:** Vercel Cron at `0 6 * * *` (6 AM UTC / 2 AM ET)

**Environment variables:**
- `CRON_ENABLED` — master switch (skip everything if false, useful for dev/staging)
- `SCORES_DATE_OFFSET` — days back to fetch (default: 1 for yesterday, configurable for backfills)
- `SCORES_DRY_RUN` — runs fetch/compute but skips DB writes and email sends

**Process:**
1. Check `CRON_ENABLED`, bail if false
2. Compute target date: `today - SCORES_DATE_OFFSET`
3. Fetch completed games from NHL Schedule API: `https://api.nhl.com/api/v1/schedule?date=YYYY-MM-DD`
4. For each game, fetch boxscore: `https://api.nhl.com/api/v1/game/{gameId}/boxscore`
5. Extract goals + assists per player per game
6. For each draft with `status = 'complete'`, match players against `draft_picks` and upsert `player_scores` rows (using service role key to bypass RLS)
7. After all scores written, send daily emails via Resend to all participants

**Vercel Cron config** in `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/update-scores", "schedule": "0 6 * * *" }] }
```

---

## 2. Standings Page

**Route:** `/draft/[id]/standings`
**Access:** Participants and admin (same auth pattern as coach/team pages)
**When:** Visible when `draft.status === 'complete'`

### Data Source

New API route `/api/drafts/[id]/standings` that:
1. Gets all picks for the draft joined with `draft_participants`
2. Joins with `player_scores` to compute actual points per participant (sum of goals + assists per scoring format)
3. Computes yesterday's points (scores from previous day)
4. Computes 7-day trend (daily point totals for last 7 days)
5. Returns standings array + tonight's games from NHL schedule API

All data is computed server-side. The page component receives pre-computed standings.

### Page Sections

1. **Header** — Draft name, season type badge, "SEASON STANDINGS" badge, "Draft Recap" link to `/results`

2. **Tonight's Games** — All NHL games tonight from the schedule API. Each game card shows:
   - Team logos for both teams
   - Game time
   - Games involving drafted players get a green highlighted border and a badge showing count ("2 PLAYERS")
   - Expandable: click to reveal which of your drafted players are on those teams (name + position)
   - Games without your players shown as flat, non-expandable cards

3. **Standings Table** — Each row shows:
   - Rank (medals for top 3: gold/silver/bronze)
   - Team name
   - Total actual points (sum of all drafted players' goals + assists)
   - Yesterday's points (+N green badge)
   - 7-day sparkline (mini SVG bar chart of daily point totals)
   - Games behind leader (blank for 1st place)
   - First place row highlighted green

4. **Expandable Roster** — Click a team row to expand. Shows each player with:
   - Round number
   - Team logo
   - Player name
   - Position
   - Actual goals, assists, points, games played this season

### Navigation

- Dashboard shows "View Standings" button for completed drafts (alongside existing "View Results")
- Coach page header: add "Standings" link when draft complete
- Team page header: add "Standings" link when draft complete

---

## 3. Daily Morning Email

**Provider:** Resend
**Schedule:** Sent by the cron job after scores are updated
**Subject:** `{Draft Name} — Yesterday's Results & Tonight's Games`

Each participant gets one email per draft they're in.

### Email Layout (single-column, mobile-friendly, max 480px)

1. **Header** — Green banner with draft name, "Daily Update" label, date

2. **Your Team at a Glance** — 4 stat cards in a row:
   - Position (e.g. "3rd")
   - Total Points (e.g. "231.0")
   - Yesterday (e.g. "+3.0" in green)
   - Games Back (e.g. "16.0")

3. **Your Players Yesterday** — Only players who actually played yesterday:
   - Team logo + player name
   - Opponent + game result (e.g. "DET vs BUF - W 5-2")
   - Points earned (e.g. "+2.0") with goals/assists breakdown ("1G 1A")
   - Footer: "4 of your 10 players were in action yesterday"
   - Players who didn't play are omitted entirely

4. **Tonight's Games** — All NHL games tonight:
   - Games with your players: green border, badge showing "N PLAYERS"
   - Your player names + positions listed below the matchup (always visible in email — email clients don't support interactive expand/collapse)
   - Games without your players: flat card, team logos, time

5. **Standings Snapshot** — Top 5 teams table:
   - Rank, team name, total points, yesterday's points
   - Your team's row highlighted green with "(You)" label
   - "View Full Standings" CTA button linking to standings page

6. **Footer** — Links to Draft Recap and Standings Page

---

## 4. Data Model Changes

### New migration: `005_player_scores_indexes.sql`

Add indexes to `player_scores` for the standings queries:

```sql
CREATE INDEX idx_player_scores_draft_date ON player_scores(draft_id, score_date);
CREATE INDEX idx_player_scores_player_draft ON player_scores(player_id, draft_id);
```

### New API routes

- `GET /api/drafts/[id]/standings` — returns computed standings, yesterday's points, 7-day trends, tonight's games
- `GET /api/cron/update-scores` — cron endpoint (called by Vercel Cron or manually)

### New pages

- `/draft/[id]/standings` — season standings page

### Modified pages

- Dashboard (`/dashboard/drafts/[id]`) — add "View Standings" link for completed drafts
- Coach page (`/draft/[id]/coach`) — add "Standings" header link when draft complete
- Team page (`/draft/[id]/team`) — add "Standings" header link when draft complete

---

## 5. Scoring Formats

- `1pt_per_goal_assist`: 1 point per goal + 1 point per assist (default)
- `2pt_goals_1pt_assists`: 2 points per goal + 1 point per assist

The scoring format is stored on the `drafts` table. The cron job and standings API both respect this format when computing points.

---

## 6. Dependencies

- **Resend** — already installed (`resend@6.12.2`), needs API key and debug
- **NHL Stats API** — no auth, free, rate-limited but sufficient for nightly batch
- **Vercel Cron** — configured in `vercel.json`
- **Recharts** — already installed, used for 7-day sparklines on standings page
