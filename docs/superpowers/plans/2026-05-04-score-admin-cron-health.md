# Score Admin & Cron Health Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cron health logging and a post-draft admin score editor so the admin can verify scoring correctness and fix errors.

**Architecture:** Add a `cron_runs` table to log every cron execution. Modify the cron handler to write runs and track unmatched player names. Create 3 new API endpoints (scores PATCH, cron-runs GET, backfill POST) and one new admin page with 3 tabs (Scores, Cron Log, Backfill). Add a "Manage Scores" button to the dashboard command center.

**Tech Stack:** Next.js API routes, Supabase admin client, Tailwind (existing dark theme palette), TeamLogo component

---

## File Structure

### New files
- `supabase/migrations/006_cron_runs.sql` — `cron_runs` table + RLS
- `app/src/app/api/drafts/[id]/scores/route.ts` — PATCH (edit player totals)
- `app/src/app/api/drafts/[id]/cron-runs/route.ts` — GET (list last 30 runs)
- `app/src/app/api/drafts/[id]/backfill/route.ts` — POST (re-run dates)
- `app/src/app/dashboard/drafts/[id]/scores/page.tsx` — Admin score manager page

### Modified files
- `app/src/app/api/cron/update-scores/route.ts` — Log runs, track unmatched, score in-progress drafts
- `app/src/app/page.tsx` — Add "Manage Scores" button to command center header

---

### Task 1: Create `cron_runs` migration

**Files:**
- Create: `supabase/migrations/006_cron_runs.sql`

- [ ] **Step 1: Write the migration**

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

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view cron runs" ON cron_runs FOR SELECT USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Service role can insert cron runs" ON cron_runs FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Run the migration**

Execute the SQL in the Supabase dashboard SQL editor.

- [ ] **Step 3: Verify**

Check that `cron_runs` table exists in Supabase with RLS enabled and both policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_cron_runs.sql
git commit -m "add cron_runs table for health logging"
```

---

### Task 2: Modify cron handler to log runs and track unmatched names

**Files:**
- Modify: `app/src/app/api/cron/update-scores/route.ts`

This is a full rewrite of the file. Key changes from the original:
1. Draft query uses `.in('status', ['complete', 'in_progress'])` instead of `.eq('status', 'complete')`
2. Track unmatched NHL player names (boxscore names not matching any draft pick)
3. Insert a `cron_runs` row after processing each draft
4. Only send emails for `complete` drafts (unchanged)

- [ ] **Step 1: Rewrite the cron handler**

Replace the entire content of `app/src/app/api/cron/update-scores/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { fetchCompletedGames, fetchGameResults, buildNhlIdToNameMap, fetchTonightGames } from '@/lib/nhl-api';
import { sendDailyEmails } from '@/lib/send-daily-email';

export async function GET(request: Request) {
  if (process.env.CRON_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Cron disabled' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  let dateStr: string;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    dateStr = dateParam;
  } else {
    const offset = parseInt(process.env.SCORES_DATE_OFFSET ?? '1', 10);
    const etParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const todayET = `${etParts.find(p => p.type === "year")!.value}-${etParts.find(p => p.type === "month")!.value}-${etParts.find(p => p.type === "day")!.value}`;
    const targetDate = new Date(`${todayET}T12:00:00`);
    targetDate.setDate(targetDate.getDate() - offset);
    dateStr = targetDate.toISOString().slice(0, 10);
  }

  const dryRun = process.env.SCORES_DRY_RUN === 'true';

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: drafts, error: draftsError } = await adminClient
    .from('drafts')
    .select('id, scoring_format, season_type, status')
    .in('status', ['complete', 'in_progress']);

  if (draftsError || !drafts || drafts.length === 0) {
    return NextResponse.json({
      date: dateStr, games: 0, results: 0, upserted: 0, dryRun,
      error: 'No active or completed drafts found',
    });
  }

  const completedGames = await fetchCompletedGames(dateStr);
  const teamAbbrevs = [...new Set(completedGames.flatMap((g) => [g.away, g.home]))];
  const nhlIdToName = await buildNhlIdToNameMap(teamAbbrevs);

  const allResults: Awaited<ReturnType<typeof fetchGameResults>> = [];
  for (const game of completedGames) {
    const results = await fetchGameResults(game.gameId);
    allResults.push(...results);
  }

  if (dryRun) {
    return NextResponse.json({
      date: dateStr, games: completedGames.length, results: allResults.length,
      upserted: 0, emailsSent: 0, emailErrors: [] as string[], dryRun: true,
    });
  }

  let totalUpserted = 0;
  const allErrors: string[] = [];

  for (const draft of drafts) {
    const { data: picks } = await adminClient
      .from('draft_picks')
      .select('player_id, player_name')
      .eq('draft_id', draft.id);

    if (!picks || picks.length === 0) {
      await adminClient.from('cron_runs').insert({
        draft_id: draft.id, run_date: dateStr,
        games_found: completedGames.length, results_found: allResults.length,
        scores_upserted: 0, emails_sent: 0, errors: ['No picks found'],
      });
      continue;
    }

    const pickMap = new Map<string, string>();
    for (const pick of picks) {
      if (pick.player_name) pickMap.set(pick.player_name.toLowerCase(), pick.player_id);
    }

    const rowsToUpsert: { player_id: string; draft_id: string; season_type: string; score_date: string; goals: number; assists: number; points: number }[] = [];
    const unmatchedNames: string[] = [];

    for (const result of allResults) {
      const fullName = nhlIdToName.get(result.nhlId);
      if (!fullName) continue;
      const playerId = pickMap.get(fullName.toLowerCase());
      if (!playerId) { unmatchedNames.push(fullName); continue; }

      const points = draft.scoring_format === '2pt_goals_1pt_assists'
        ? result.goals * 2 + result.assists
        : result.goals + result.assists;

      rowsToUpsert.push({
        player_id: playerId, draft_id: draft.id,
        season_type: draft.season_type ?? 'regular_season',
        score_date: dateStr, goals: result.goals, assists: result.assists, points,
      });
    }

    const errors: string[] = [];
    let upserted = 0;

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await adminClient
        .from('player_scores')
        .upsert(rowsToUpsert, { onConflict: 'player_id,draft_id,score_date' });
      if (upsertError) errors.push(`Upsert error: ${upsertError.message}`);
      else upserted = rowsToUpsert.length;
    }

    if (unmatchedNames.length > 0) errors.push(`Unmatched: ${unmatchedNames.join(', ')}`);
    totalUpserted += upserted;
    allErrors.push(...errors);

    let emailsSent = 0;
    const emailErrors: string[] = [];

    if (draft.status === 'complete') {
      const { data: draftDetails } = await adminClient
        .from('drafts').select('id, name, scoring_format, season_type').eq('id', draft.id).single();
      const { data: participants } = await adminClient
        .from('draft_participants').select('id, team_name, user_id').eq('draft_id', draft.id);

      if (draftDetails && participants && participants.length > 0) {
        const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers();
        const emailMap = new Map<string, string>();
        for (const u of authUsers ?? []) { if (u.email) emailMap.set(u.id, u.email); }

        const participantsWithEmail = participants
          .map((p) => ({ email: emailMap.get(p.user_id) ?? '', participantId: p.id, teamName: p.team_name }))
          .filter((p) => p.email.length > 0);

        if (participantsWithEmail.length > 0) {
          const { data: draftPicks } = await adminClient.from('draft_picks').select('player_id, player_name, participant_id, round').eq('draft_id', draft.id);
          const { data: draftScores } = await adminClient.from('player_scores').select('player_id, score_date, goals, assists, points').eq('draft_id', draft.id);
          const { data: draftPlayers } = await adminClient.from('players').select('id, name, team, position');

          const playerMap = new Map((draftPlayers ?? []).map((p) => [p.id, p]));
          const scoresByPlayer = new Map<string, Map<string, { goals: number; assists: number; points: number }>>();
          for (const s of draftScores ?? []) {
            if (!scoresByPlayer.has(s.player_id)) scoresByPlayer.set(s.player_id, new Map());
            scoresByPlayer.get(s.player_id)!.set(s.score_date, { goals: s.goals, assists: s.assists, points: s.points });
          }

          const standings = participants.map((p) => {
            const myPicks = (draftPicks ?? []).filter((pick) => pick.participant_id === p.id);
            const roster = myPicks.map((pick) => {
              const player = playerMap.get(pick.player_id);
              const playerScores = scoresByPlayer.get(pick.player_id);
              let goals = 0, assists = 0, points = 0, gamesPlayed = 0;
              if (playerScores) { for (const [, ds] of playerScores) { goals += ds.goals; assists += ds.assists; points += ds.points; gamesPlayed++; } }
              const yesterdayScore = scoresByPlayer.get(pick.player_id)?.get(dateStr);
              return { playerId: pick.player_id, playerName: pick.player_name, team: player?.team ?? '', position: player?.position ?? '', round: pick.round, goals, assists, points, gamesPlayed, yesterdayGoals: yesterdayScore?.goals ?? 0, yesterdayAssists: yesterdayScore?.assists ?? 0, yesterdayPoints: yesterdayScore?.points ?? 0 };
            });
            const totalPoints = roster.reduce((sum, r) => sum + r.points, 0);
            let yesterdayPoints = 0;
            for (const r of roster) { const ds = scoresByPlayer.get(r.playerId)?.get(dateStr); if (ds) yesterdayPoints += ds.points; }
            return { participantId: p.id, teamName: p.team_name, totalPoints, yesterdayPoints, roster };
          }).sort((a, b) => b.totalPoints - a.totalPoints);

          const tonightGames = await fetchTonightGames().catch(() => []);
          const result = await sendDailyEmails({
            draftId: draft.id, draftName: draftDetails.name ?? 'Draft',
            seasonType: draftDetails.season_type ?? 'regular_season',
            date: dateStr, standings, tonightGames, participantsWithEmail,
            baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
          });
          emailsSent = result.sent;
          emailErrors.push(...result.errors);
        }
      }
    }

    await adminClient.from('cron_runs').insert({
      draft_id: draft.id, run_date: dateStr,
      games_found: completedGames.length, results_found: allResults.length,
      scores_upserted: upserted, emails_sent: emailsSent,
      errors: [...errors, ...emailErrors],
    });
  }

  return NextResponse.json({
    date: dateStr, games: completedGames.length, results: allResults.length,
    upserted: totalUpserted, errors: allErrors, dryRun: false,
  });
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/cron/update-scores/route.ts
git commit -m "log cron runs, track unmatched players, score in-progress drafts"
```

---

### Task 3: Create admin API endpoints

**Files:**
- Create: `app/src/app/api/drafts/[id]/scores/route.ts`
- Create: `app/src/app/api/drafts/[id]/cron-runs/route.ts`
- Create: `app/src/app/api/drafts/[id]/backfill/route.ts`

- [ ] **Step 1: Create scores PATCH endpoint**

Create `app/src/app/api/drafts/[id]/scores/route.ts`:

This endpoint handles master score editing. The admin sets a player's total G/A. The implementation deletes all existing `player_scores` rows for that player+draft and inserts a single aggregate row with the new totals. This is the simplest way to do a "master edit" — the admin is saying "this player's total should be X goals and Y assists."

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: draft } = await supabase
    .from('drafts').select('admin_user_id, scoring_format').eq('id', id).single();
  if (!draft || draft.admin_user_id !== user.id)
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

  const { player_id, goals, assists } = await request.json();
  if (!player_id) return NextResponse.json({ error: 'player_id required' }, { status: 400 });

  const g = typeof goals === 'number' ? goals : 0;
  const a = typeof assists === 'number' ? assists : 0;
  const pts = draft.scoring_format === '2pt_goals_1pt_assists' ? g * 2 + a : g + a;

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: existing } = await adminClient
    .from('player_scores').select('season_type').eq('draft_id', id).eq('player_id', player_id).limit(1);
  const seasonType = (existing && existing.length > 0) ? existing[0].season_type : 'playoffs';

  await adminClient.from('player_scores').delete().eq('draft_id', id).eq('player_id', player_id);

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await adminClient.from('player_scores').insert({
    player_id, draft_id: id, score_date: today, season_type: seasonType,
    goals: g, assists: a, points: pts,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ score: data });
}
```

- [ ] **Step 2: Create cron-runs GET endpoint**

Create `app/src/app/api/drafts/[id]/cron-runs/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: draft } = await supabase
    .from('drafts').select('admin_user_id').eq('id', id).single();
  if (!draft || draft.admin_user_id !== user.id)
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

  const { data: runs, error } = await supabase
    .from('cron_runs').select('*').eq('draft_id', id)
    .order('ran_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: runs ?? [] });
}
```

- [ ] **Step 3: Create backfill POST endpoint**

Create `app/src/app/api/drafts/[id]/backfill/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { fetchCompletedGames, fetchGameResults, buildNhlIdToNameMap } from '@/lib/nhl-api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: draft } = await supabase
    .from('drafts').select('admin_user_id, scoring_format, season_type').eq('id', id).single();
  if (!draft || draft.admin_user_id !== user.id)
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

  const { dates } = await request.json();
  if (!dates || !Array.isArray(dates) || dates.length === 0)
    return NextResponse.json({ error: 'dates array required' }, { status: 400 });

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  const { data: picks } = await adminClient
    .from('draft_picks').select('player_id, player_name').eq('draft_id', id);
  if (!picks || picks.length === 0)
    return NextResponse.json({ error: 'No picks found' }, { status: 400 });

  const pickMap = new Map<string, string>();
  for (const pick of picks) {
    if (pick.player_name) pickMap.set(pick.player_name.toLowerCase(), pick.player_id);
  }

  const results: { date: string; games: number; upserted: number; errors: string[] }[] = [];

  for (const dateStr of dates) {
    const completedGames = await fetchCompletedGames(dateStr);
    const teamAbbrevs = [...new Set(completedGames.flatMap(g => [g.away, g.home]))];
    const nhlIdToName = await buildNhlIdToNameMap(teamAbbrevs);

    const allGameResults: Awaited<ReturnType<typeof fetchGameResults>> = [];
    for (const game of completedGames) {
      const gameResults = await fetchGameResults(game.gameId);
      allGameResults.push(...gameResults);
    }

    const rowsToUpsert: any[] = [];
    const errors: string[] = [];

    for (const result of allGameResults) {
      const fullName = nhlIdToName.get(result.nhlId);
      if (!fullName) continue;
      const playerId = pickMap.get(fullName.toLowerCase());
      if (!playerId) { errors.push(`Unmatched: ${fullName}`); continue; }
      const pts = draft.scoring_format === '2pt_goals_1pt_assists'
        ? result.goals * 2 + result.assists : result.goals + result.assists;
      rowsToUpsert.push({
        player_id: playerId, draft_id: id,
        season_type: draft.season_type ?? 'playoffs',
        score_date: dateStr, goals: result.goals, assists: result.assists, points: pts,
      });
    }

    let upserted = 0;
    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await adminClient
        .from('player_scores').upsert(rowsToUpsert, { onConflict: 'player_id,draft_id,score_date' });
      if (upsertError) errors.push(`Upsert error: ${upsertError.message}`);
      else upserted = rowsToUpsert.length;
    }

    await adminClient.from('cron_runs').insert({
      draft_id: id, run_date: dateStr,
      games_found: completedGames.length, results_found: allGameResults.length,
      scores_upserted: upserted, emails_sent: 0, errors,
    });

    results.push({ date: dateStr, games: completedGames.length, upserted, errors });
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/drafts/[id]/scores/route.ts app/src/app/api/drafts/[id]/cron-runs/route.ts app/src/app/api/drafts/[id]/backfill/route.ts
git commit -m "add admin API endpoints for scores, cron runs, and backfill"
```

---

### Task 4: Build admin score manager page

**Files:**
- Create: `app/src/app/dashboard/drafts/[id]/scores/page.tsx`

This page has three tabs: Scores, Cron Log, Backfill. It follows the existing dark theme patterns and reuses `TeamLogo`.

- [ ] **Step 1: Create the page**

Create `app/src/app/dashboard/drafts/[id]/scores/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import TeamLogo from '@/components/TeamLogo';

interface RosterPlayer {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  round: number;
  goals: number;
  assists: number;
  points: number;
  gamesPlayed: number;
  injuryStatus: string;
  injuryDescription: string | null;
  isEliminated: boolean;
}

interface StandingEntry {
  participantId: string;
  teamName: string;
  rank: number;
  totalPoints: number;
  yesterdayPoints: number;
  gamesBehind: number;
  roster: RosterPlayer[];
}

interface CronRun {
  id: string;
  run_date: string;
  games_found: number;
  results_found: number;
  scores_upserted: number;
  emails_sent: number;
  errors: string[];
  ran_at: string;
}

interface DraftInfo {
  id: string;
  name: string;
  season_type: string;
  players_per_team: number;
  scoring_format: string;
}

const TABS = ['scores', 'cron-log', 'backfill'] as const;
type Tab = typeof TABS[number];

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

export default function ScoresPage() {
  const params = useParams();
  const { user } = useAuth();
  const draftId = params.id as string;

  const [tab, setTab] = useState<Tab>('scores');
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [editGoals, setEditGoals] = useState(0);
  const [editAssists, setEditAssists] = useState(0);
  const [saving, setSaving] = useState(false);

  const [cronRuns, setCronRuns] = useState<CronRun[]>([]);

  const [backfillDates, setBackfillDates] = useState<{ date: string; day: string; status: string; scores: number }[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);

  const fetchStandings = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/drafts/${draftId}/standings`);
    if (res.ok) {
      const data = await res.json();
      setDraft(data.draft);
      setStandings(data.standings || []);
    }
    setLoading(false);
  }, [draftId]);

  const fetchCronRuns = useCallback(async () => {
    const res = await fetch(`/api/drafts/${draftId}/cron-runs`);
    if (res.ok) {
      const data = await res.json();
      setCronRuns(data.runs || []);
    }
  }, [draftId]);

  const buildBackfillDates = useCallback(async () => {
    const runsRes = await fetch(`/api/drafts/${draftId}/cron-runs`);
    const runsData = runsRes.ok ? await runsRes.json() : { runs: [] };
    const runMap = new Map((runsData.runs || []).map((r: CronRun) => [r.run_date, r]));

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dates: { date: string; day: string; status: string; scores: number }[] = [];
    const now = new Date();
    for (let i = 1; i <= 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const day = days[d.getDay()];
      const run = runMap.get(dateStr);
      if (run) {
        const hasErrors = run.errors && run.errors.length > 0;
        const hasUnmatchedOnly = hasErrors && run.errors.every((e: string) => e.startsWith('Unmatched:'));
        const status = run.scores_upserted === 0 && hasErrors && !hasUnmatchedOnly
          ? `0 scores · error`
          : hasUnmatchedOnly
            ? `${run.scores_upserted} scores · ${run.errors.filter((e: string) => e.startsWith('Unmatched:')).flatMap((e: string) => e.replace('Unmatched: ', '').split(', ')).length} unmatched`
            : `${run.scores_upserted} scores`;
        dates.push({ date: dateStr, day, status, scores: run.scores_upserted });
      } else {
        dates.push({ date: dateStr, day, status: 'No run recorded', scores: 0 });
      }
    }
    setBackfillDates(dates);
  }, [draftId]);

  useEffect(() => {
    if (!user) return;
    fetchStandings();
  }, [user, fetchStandings]);

  useEffect(() => {
    if (!user) return;
    if (tab === 'cron-log') fetchCronRuns();
    if (tab === 'backfill') buildBackfillDates();
  }, [user, tab, fetchCronRuns, buildBackfillDates]);

  const handleSave = async (playerId: string) => {
    setSaving(true);
    await fetch(`/api/drafts/${draftId}/scores`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, goals: editGoals, assists: editAssists }),
    });
    setEditingPlayer(null);
    setSaving(false);
    fetchStandings();
  };

  const handleBackfill = async () => {
    const dates = Array.from(selectedDates).sort();
    if (dates.length === 0) return;
    setBackfilling(true);
    setBackfillResult(null);
    const res = await fetch(`/api/drafts/${draftId}/backfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dates }),
    });
    if (res.ok) setBackfillResult(await res.json());
    setBackfilling(false);
    buildBackfillDates();
  };

  const toggleDate = (date: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  if (!draft) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-[#5a6b57]">{loading ? 'Loading...' : 'Draft not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-[#5a6b57] mb-1">Admin</div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#c8d9c3]">{draft.name}</h1>
          <div className="flex items-center justify-center gap-3 text-sm text-[#5a6b57] mt-1">
            <span>{draft.season_type === 'playoffs' ? 'Playoffs' : 'Regular Season'}</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{standings.length} Managers</span>
            <span className="text-[#1a2f1a]">&bull;</span>
            <span>{draft.players_per_team} Rounds</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 mb-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t ? 'bg-[#4a7c59] text-[#c8d9c3]' : 'text-[#5a6b57] hover:text-[#c8d9c3]'
              }`}
            >
              {t === 'cron-log' ? 'Cron Log' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'scores' && (
          <div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Team Scores</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-0 text-xs bg-[#0d150d] border-b border-[#1a2f1a]">
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-center w-12">#</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57]">TEAM</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-right w-16">PTS</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-center w-20 hidden sm:block">YESTERDAY</div>
                <div className="px-4 py-3 font-semibold text-[#5a6b57] text-right w-12 hidden sm:block">GB</div>
                <div className="px-4 py-3 w-8" />
              </div>
              <div>
                {standings.map((s, idx) => {
                  const isExpanded = expandedTeam === s.participantId;
                  return (
                    <div key={s.participantId}>
                      <div
                        onClick={() => setExpandedTeam(isExpanded ? null : s.participantId)}
                        className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-0 text-sm cursor-pointer transition-colors ${
                          s.rank === 1 ? 'bg-[#0f1f0f] hover:bg-[#142a14]'
                          : idx % 2 === 0 ? 'bg-[#050a05] hover:bg-[#0a0f0a]'
                          : 'bg-[#070c07] hover:bg-[#0a0f0a]'
                        }`}
                      >
                        <div className="px-4 py-3 font-bold text-center w-12" style={s.rank <= 3 ? { color: RANK_COLORS[s.rank - 1] } : undefined}>
                          {s.rank <= 3 ? RANK_MEDALS[s.rank - 1] : s.rank}
                        </div>
                        <div className={`px-4 py-3 font-bold ${s.rank === 1 ? 'text-[#6b9b7a]' : 'text-[#c8d9c3]'}`}>
                          {s.teamName}
                        </div>
                        <div className={`px-4 py-3 text-right font-bold w-16 ${s.rank === 1 ? 'text-[#6b9b7a] text-base' : 'text-[#c8d9c3]'}`}>
                          {s.totalPoints}
                        </div>
                        <div className="px-4 py-3 text-center w-20 hidden sm:block">
                          {s.yesterdayPoints > 0 ? (
                            <span className="inline-block px-2 py-0.5 bg-[#1a3d1a] text-[#6b9b7a] text-xs font-bold rounded">+{s.yesterdayPoints}</span>
                          ) : (
                            <span className="text-[#2d3c28]">&mdash;</span>
                          )}
                        </div>
                        <div className="px-4 py-3 text-right w-12 text-[#5a6b57] hidden sm:block">
                          {s.gamesBehind === 0 ? '-' : s.gamesBehind}
                        </div>
                        <div className="px-2 py-3 w-8" />
                      </div>
                      {isExpanded && (
                        <div className="bg-[#030803] border-t border-[#0d150d] border-b border-[#1a2f1a] px-4 py-3">
                          <div className="space-y-1">
                            {s.roster.sort((a, b) => a.round - b.round).map((p) => {
                              const isOut = p.injuryStatus === 'out indefinitely' || p.injuryStatus === 'out for playoffs';
                              const isInactive = isOut || p.isEliminated;
                              const isEditing = editingPlayer === p.playerId;
                              const injuryLabel = p.injuryStatus === 'day-to-day' ? 'DTD' : p.injuryStatus === 'week-to-week' ? 'WTW' : (p.injuryStatus === 'out indefinitely' || p.injuryStatus === 'out for playoffs') ? 'OUT' : null;
                              const injuryBadgeColor = p.injuryStatus === 'day-to-day' ? 'bg-[#854d0e] text-[#fbbf24]' : p.injuryStatus === 'week-to-week' ? 'bg-[#9a3412] text-[#fb923c]' : 'bg-[#7f1d1d] text-[#fca5a5]';
                              return (
                                <div key={p.playerId} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${isInactive ? 'opacity-50' : ''} ${isEditing ? 'bg-[#0a0f0a] border border-[#4a7c59]' : ''}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#5a6b57] w-5 text-right font-mono text-[10px]">{p.round}</span>
                                    <TeamLogo team={p.team} className="w-4 h-4" />
                                    <span className={`font-medium ${p.isEliminated ? 'text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2' : 'text-[#c8d9c3]'}`}>
                                      {p.playerName}
                                    </span>
                                    <span className="text-[#5a6b57]">{p.position}</span>
                                    {injuryLabel && (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${injuryBadgeColor}`}>{injuryLabel}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {isEditing ? (
                                      <>
                                        <input type="number" min={0} value={editGoals} onChange={e => setEditGoals(parseInt(e.target.value) || 0)} className="w-9 px-1 py-0.5 text-center text-xs bg-[#050a05] border border-[#4a7c59] rounded text-[#c8d9c3] focus:outline-none" />
                                        <input type="number" min={0} value={editAssists} onChange={e => setEditAssists(parseInt(e.target.value) || 0)} className="w-9 px-1 py-0.5 text-center text-xs bg-[#050a05] border border-[#4a7c59] rounded text-[#c8d9c3] focus:outline-none" />
                                        <span className="text-[#6b9b7a] font-bold w-8 text-center">{draft.scoring_format === '2pt_goals_1pt_assists' ? editGoals * 2 + editAssists : editGoals + editAssists}</span>
                                        <div className="flex gap-1">
                                          <button onClick={() => handleSave(p.playerId)} disabled={saving} className="text-[#6b9b7a] hover:text-[#c8d9c3] disabled:opacity-50 text-sm">✓</button>
                                          <button onClick={() => setEditingPlayer(null)} className="text-[#f87171] hover:text-red-300 text-sm">✕</button>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[#c8d9c3] w-6 text-center">{p.goals}</span>
                                        <span className="text-[#c8d9c3] w-6 text-center">{p.assists}</span>
                                        <span className="text-[#6b9b7a] font-bold w-8 text-center">{p.points}</span>
                                        <button onClick={() => { setEditingPlayer(p.playerId); setEditGoals(p.goals); setEditAssists(p.assists); }} className="text-[#6b9b7a] hover:text-[#c8d9c3] text-sm">✎</button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'cron-log' && (
          <div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Recent Runs</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            {cronRuns.length === 0 ? (
              <div className="text-[#5a6b57] text-center py-8">No cron runs recorded</div>
            ) : (
              <div className="space-y-3">
                {cronRuns.map(run => {
                  const hasErrors = run.errors && run.errors.length > 0;
                  const hasUnmatchedOnly = hasErrors && run.errors.every(e => e.startsWith('Unmatched:'));
                  const dotColor = hasErrors && !hasUnmatchedOnly ? 'bg-[#f87171]' : hasUnmatchedOnly ? 'bg-[#9b8f6b]' : 'bg-[#4a7c59]';
                  const runTime = new Date(run.ran_at).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
                  return (
                    <div key={run.id} className={`bg-[#0a0f0a] border ${hasErrors && !hasUnmatchedOnly ? 'border-[#3d1a1a]' : 'border-[#141e12]'} rounded-lg p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span className="font-mono text-sm text-[#c8d9c3]">{run.run_date}</span>
                        </div>
                        <span className="text-xs text-[#5a6b57]">{runTime}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div><div className="text-[9px] text-[#5a6b57] uppercase">Games</div><div className="font-semibold mt-0.5">{run.games_found}</div></div>
                        <div><div className="text-[9px] text-[#5a6b57] uppercase">Results</div><div className="font-semibold mt-0.5">{run.results_found}</div></div>
                        <div><div className="text-[9px] text-[#5a6b57] uppercase">Scores</div><div className="font-semibold text-[#6b9b7a] mt-0.5">{run.scores_upserted}</div></div>
                        <div><div className="text-[9px] text-[#5a6b57] uppercase">Emails</div><div className="font-semibold mt-0.5">{run.emails_sent}</div></div>
                      </div>
                      {hasErrors && (
                        <div className={`mt-3 pt-3 border-t ${hasErrors && !hasUnmatchedOnly ? 'border-[#3d1a1a]' : 'border-[#141e12]'}`}>
                          {run.errors.map((err, i) => (
                            <div key={i} className={`text-xs ${err.startsWith('Unmatched:') ? 'text-[#9b8f6b]' : 'text-[#f87171]'}`}>{err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-4 mt-4 text-[10px] text-[#5a6b57]">
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#4a7c59]" /> Healthy</div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#9b8f6b]" /> Warnings</div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#f87171]" /> Errors</div>
            </div>
          </div>
        )}

        {tab === 'backfill' && (
          <div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#1a2f1a]" />
              <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Select Dates to Re-Run</h2>
              <div className="h-px flex-1 bg-[#1a2f1a]" />
            </div>
            <div className="text-xs text-[#5a6b57] mb-3">Check dates to re-score. Dates with no run may have been missed.</div>
            <div className="bg-[#0a0f0a] border border-[#141e12] rounded-xl overflow-hidden">
              {backfillDates.map((d, i) => {
                const isSelected = selectedDates.has(d.date);
                const isError = d.status.includes('error');
                const isNoRun = d.status === 'No run recorded';
                return (
                  <div key={d.date} onClick={() => toggleDate(d.date)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#0a0f0a] transition-colors ${i % 2 === 0 ? 'bg-[#050a05]' : 'bg-[#070c07]'}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="accent-[#4a7c59] w-3.5 h-3.5 cursor-pointer" />
                    <span className="font-mono text-sm text-[#c8d9c3]">{d.date}</span>
                    <span className={`text-[10px] ${isError || isNoRun ? 'text-[#f87171]' : d.status.includes('unmatched') ? 'text-[#9b8f6b]' : 'text-[#6b9b7a]'}`}>{d.status}</span>
                    <span className="ml-auto text-[10px] text-[#5a6b57]">{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-[#5a6b57]">{selectedDates.size} date{selectedDates.size !== 1 ? 's' : ''} selected</span>
              <button onClick={handleBackfill} disabled={backfilling || selectedDates.size === 0} className="px-5 py-2 text-sm font-medium bg-[#4a7c59] text-[#c8d9c3] rounded-lg hover:bg-[#3d664a] transition-colors disabled:opacity-50">
                {backfilling ? 'Running...' : 'Run Backfill'}
              </button>
            </div>
            {backfillResult && (
              <div className="mt-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-[#1a2f1a]" />
                  <h2 className="text-xs font-bold text-[#5a6b57] uppercase tracking-widest">Results</h2>
                  <div className="h-px flex-1 bg-[#1a2f1a]" />
                </div>
                <div className="bg-[#0a0f0a] border border-[#4a7c59] rounded-lg p-4 space-y-2">
                  {backfillResult.results?.map((r: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full ${r.errors?.length > 0 ? 'bg-[#9b8f6b]' : 'bg-[#4a7c59]'}`} />
                        <span className="font-mono text-[#c8d9c3]">{r.date}</span>
                        <span className="text-[#6b9b7a] font-semibold">{r.upserted} scores</span>
                        <span className="text-[#5a6b57]">/ {r.games} games</span>
                      </div>
                      {r.errors?.filter((e: string) => e.startsWith('Unmatched:')).map((e: string, j: number) => (
                        <div key={j} className="ml-4 text-[10px] text-[#9b8f6b]">⚠ {e}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/dashboard/drafts/[id]/scores/page.tsx
git commit -m "add admin score manager page with cron log and backfill tabs"
```

---

### Task 5: Add "Manage Scores" button to dashboard command center

**Files:**
- Modify: `app/src/app/page.tsx`

Add a "Manage Scores" link button in the command center header, visible only when the draft is `complete` and the user is the admin. It goes in the header bar next to the rank and delete button.

- [ ] **Step 1: Add the button**

In `app/src/app/page.tsx`, find the command center header section (around line 195-212). The `{isAdmin && (...)` block currently only has the delete button. Add a "Manage Scores" link before the delete button:

Find this code block inside the `isAdmin` conditional (around line 202-211):

```tsx
              {isAdmin && (
                <button
                  onClick={(e) => handleDeleteDraft(e, draft.id, draft.name)}
                  disabled={deleting === draft.id}
                  className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm disabled:opacity-50 p-2"
                  title="Delete draft"
                >
                  {deleting === draft.id ? '...' : '\u2715'}
                </button>
              )}
```

Replace with:

```tsx
              {isAdmin && (
                <>
                  <Link
                    href={`/dashboard/drafts/${draft.id}/scores`}
                    className="px-3 py-1.5 text-xs font-medium border border-[#9b8f6b] text-[#9b8f6b] rounded-lg hover:bg-[#0a0f0a] transition-colors"
                  >
                    Manage Scores
                  </Link>
                  <button
                    onClick={(e) => handleDeleteDraft(e, draft.id, draft.name)}
                    disabled={deleting === draft.id}
                    className="text-[#5a6b57] hover:text-red-400 transition-colors text-sm disabled:opacity-50 p-2"
                    title="Delete draft"
                  >
                    {deleting === draft.id ? '...' : '\u2715'}
                  </button>
                </>
              )}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/src/app/page.tsx
git commit -m "add Manage Scores button to dashboard command center"
```

---

## Self-Review

**1. Spec coverage:**
- Scores tab (standings-style with master editor, pencil/edit, checkmark/X, team logos) → Task 4 ✓
- Cron log (last 30 runs, green/amber/red dots, unmatched names, MST timestamps) → Task 4 ✓
- Backfill (checkbox list of recent dates, run button, per-date results) → Task 4 ✓
- `cron_runs` table → Task 1 ✓
- Cron handler logging + unmatched tracking → Task 2 ✓
- Scores PATCH API (master editor via delete+insert) → Task 3 ✓
- Cron runs GET API → Task 3 ✓
- Backfill POST API → Task 3 ✓
- "Manage Scores" button on dashboard → Task 5 ✓
- No "Back to Dashboard" links → ✓ (not in the page code)
- Score in-progress drafts → Task 2 ✓

**2. Placeholder scan:** No TBD/TODO/placeholders found. All code is complete.

**3. Type consistency:** `StandingEntry` interface matches what the `/api/drafts/[id]/standings` endpoint returns. `CronRun` interface matches `cron_runs` table columns. `DraftInfo` matches standings response `draft` object. All API request bodies match what the page sends.
