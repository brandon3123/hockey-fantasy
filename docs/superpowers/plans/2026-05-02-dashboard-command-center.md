# Dashboard Command Center + /games Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the dashboard into a live command center with widgets for standings, team, games, injuries, eliminations; add a new `/games` page.

**Architecture:** New `/api/dashboard` endpoint aggregates all data in one call. Dashboard page renders widgets when a complete draft exists, falls back to draft list otherwise. New `/games` page with `/api/games` endpoint shows tonight's schedule with rostered player highlights.

**Tech Stack:** Next.js App Router, Supabase (server client + admin client), existing `nhl-api.ts` functions, TeamLogo component

---

## File Structure

### New files
- `app/src/app/api/dashboard/route.ts` — aggregated dashboard data API
- `app/src/app/api/games/route.ts` — tonight's games API with rostered player info
- `app/src/app/games/page.tsx` — tonight's games page

### Modified files
- `app/src/app/page.tsx` — complete rewrite of authenticated view
- `app/src/components/Navigation.tsx` — add Games nav link

### Existing files (read-only reference)
- `app/src/lib/nhl-api.ts` — `fetchTonightGames`, `fetchEspnInjuries`, `fetchActivePlayoffTeams`
- `app/src/components/TeamLogo.tsx` — team logo component
- `app/src/components/InjuryFlag.tsx` — injury badge component
- `app/src/app/api/drafts/[id]/standings/route.ts` — reference for score computation patterns

---

### Task 1: Create `/api/dashboard` endpoint

**Files:**
- Create: `app/src/app/api/dashboard/route.ts`

This endpoint finds the user's most recent `complete` draft and returns all widget data in one response.

- [ ] **Step 1: Create the dashboard API route**

Create `app/src/app/api/dashboard/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { fetchTonightGames, fetchEspnInjuries, fetchActivePlayoffTeams } from '@/lib/nhl-api';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: drafts } = await supabase
    .from('drafts')
    .select('id, name, status, season_type, scoring_format, created_at')
    .eq('admin_user_id', user.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false });

  const { data: participations } = await supabase
    .from('draft_participants')
    .select('draft_id')
    .eq('user_id', user.id);

  const participatedDraftIds = new Set((participations || []).map(p => p.draft_id));

  const completeDraft = (drafts || []).find(d =>
    participatedDraftIds.has(d.id) || true
  );

  if (!completeDraft) {
    const { data: joinedDrafts } = await supabase
      .from('drafts')
      .select('id, name, status, season_type, scoring_format, created_at')
      .in('id', [...participatedDraftIds])
      .eq('status', 'complete')
      .order('created_at', { ascending: false });

    if (!joinedDrafts || joinedDrafts.length === 0) {
      return NextResponse.json({ draft: null });
    }
  }

  const draft = completeDraft || await (async () => {
    const { data } = await supabase
      .from('drafts')
      .select('id, name, status, season_type, scoring_format, created_at')
      .in('id', [...participatedDraftIds])
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);
    return data?.[0];
  })();

  if (!draft) {
    return NextResponse.json({ draft: null });
  }

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll() { return []; }, setAll() {} },
    }
  );

  const [picksResult, participantResult, myParticipantResult, scoresResult, playersResult] = await Promise.all([
    adminClient.from('draft_picks').select('player_id, player_name, participant_id').eq('draft_id', draft.id),
    adminClient.from('draft_participants').select('id, team_name, user_id').eq('draft_id', draft.id),
    adminClient.from('draft_participants').select('id').eq('draft_id', draft.id).eq('user_id', user.id).limit(1),
    adminClient.from('player_scores').select('player_id, score_date, goals, assists, points').eq('draft_id', draft.id),
    adminClient.from('players').select('id, name, team, position'),
  ]);

  const picks = picksResult.data || [];
  const participants = participantResult.data || [];
  const myParticipant = myParticipantResult.data?.[0];
  const scores = scoresResult.data || [];
  const players = playersResult.data || [];

  if (!myParticipant) {
    return NextResponse.json({ draft: { id: draft.id, name: draft.name, status: draft.status }, rank: null });
  }

  const playerMap = new Map<string, { name: string; team: string; position: string }>();
  for (const p of players) {
    playerMap.set(p.id, { name: p.name, team: p.team, position: p.position });
  }

  const scoresByPlayer = new Map<string, Map<string, { goals: number; assists: number; points: number }>>();
  for (const s of scores) {
    if (!scoresByPlayer.has(s.player_id)) scoresByPlayer.set(s.player_id, new Map());
    scoresByPlayer.get(s.player_id)!.set(s.score_date, { goals: s.goals, assists: s.assists, points: s.points });
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const todayET = `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
  const yesterdayDate = new Date(`${todayET}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const teamTotals = new Map<string, number>();
  const teamByParticipant = new Map<string, string>();
  for (const p of participants) {
    teamByParticipant.set(p.id, p.team_name);
    teamTotals.set(p.id, 0);
  }

  const picksByParticipant = new Map<string, typeof picks>();
  for (const pick of picks) {
    if (!picksByParticipant.has(pick.participant_id)) picksByParticipant.set(pick.participant_id, []);
    picksByParticipant.get(pick.participant_id)!.push(pick);

    const playerScores = scoresByPlayer.get(pick.player_id);
    let total = 0;
    if (playerScores) {
      for (const [, ds] of playerScores) total += ds.points;
    }
    teamTotals.set(pick.participant_id, (teamTotals.get(pick.participant_id) || 0) + total);
  }

  const standings = [...teamTotals.entries()]
    .map(([participantId, totalPoints]) => ({
      participantId,
      teamName: teamByParticipant.get(participantId) || 'Unknown',
      totalPoints,
      isYou: participantId === myParticipant.id,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const rank = standings.findIndex(s => s.isYou) + 1;

  const myPicks = picksByParticipant.get(myParticipant.id) || [];
  const roster = myPicks.map(pick => {
    const player = playerMap.get(pick.player_id);
    const playerScores = scoresByPlayer.get(pick.player_id);
    let totalPoints = 0;
    let yesterdayPoints = 0;
    if (playerScores) {
      for (const [, ds] of playerScores) totalPoints += ds.points;
      const yd = playerScores.get(yesterdayStr);
      if (yd) yesterdayPoints = yd.points;
    }
    return {
      playerId: pick.player_id,
      playerName: player?.name || pick.player_name,
      team: player?.team || '',
      position: player?.position || '',
      totalPoints,
      yesterdayPoints,
    };
  });

  const totalPoints = roster.reduce((sum, r) => sum + r.totalPoints, 0);
  const yesterdayTotal = roster.reduce((sum, r) => sum + r.yesterdayPoints, 0);

  const [espnInjuries, activePlayoffTeams, tonightGames] = await Promise.all([
    fetchEspnInjuries(),
    fetchActivePlayoffTeams(),
    fetchTonightGames(),
  ]);

  const rosterWithStatus = roster.map(r => {
    const live = espnInjuries.get(r.playerName.toLowerCase());
    const isEliminated = !activePlayoffTeams.has(r.team) && activePlayoffTeams.size > 0;
    return {
      ...r,
      injuryStatus: live?.status || 'healthy',
      injuryDescription: live?.description || null,
      isEliminated,
    };
  });

  const tonightTeams = new Set(tonightGames.flatMap(g => [g.away, g.home]));
  const activePlayerCount = rosterWithStatus.filter(r => tonightTeams.has(r.team)).length;

  const allPlayoffTeams = new Set<string>();
  const eliminatedTeamsSet = new Set<string>();
  try {
    const bracketRes = await fetch("https://api-web.nhle.com/v1/playoff-bracket/2026");
    if (bracketRes.ok) {
      const bracketData = await bracketRes.json();
      for (const series of bracketData.series || []) {
        const top = series.topSeedTeam?.abbrev;
        const bottom = series.bottomSeedTeam?.abbrev;
        if (top && top !== "TBD") allPlayoffTeams.add(top);
        if (bottom && bottom !== "TBD") allPlayoffTeams.add(bottom);
        if (series.winningTeamId && series.losingTeamId) {
          if (series.topSeedTeam?.id === series.losingTeamId && top) eliminatedTeamsSet.add(top);
          if (series.bottomSeedTeam?.id === series.losingTeamId && bottom) eliminatedTeamsSet.add(bottom);
        }
      }
    }
  } catch {}

  return NextResponse.json({
    draft: {
      id: draft.id,
      name: draft.name,
      status: draft.status,
      seasonType: draft.season_type,
      scoringFormat: draft.scoring_format,
    },
    rank,
    totalTeams: participants.length,
    totalPoints,
    yesterdayPoints: yesterdayTotal,
    roster: rosterWithStatus,
    standings: standings.slice(0, 5),
    tonightGames: tonightGames.map(g => ({
      away: g.away,
      home: g.home,
      awayLogo: g.awayLogo,
      homeLogo: g.homeLogo,
      time: g.time,
    })),
    activePlayerCount,
    eliminatedTeams: [...eliminatedTeamsSet],
    totalPlayoffTeams: allPlayoffTeams.size,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/dashboard/route.ts
git commit -m "add /api/dashboard endpoint with aggregated widget data"
```

---

### Task 2: Create `/api/games` endpoint

**Files:**
- Create: `app/src/app/api/games/route.ts`

- [ ] **Step 1: Create the games API route**

Create `app/src/app/api/games/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { fetchTonightGames } from '@/lib/nhl-api';

export async function GET() {
  const tonightGames = await fetchTonightGames();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      games: tonightGames.map(g => ({
        away: g.away,
        home: g.home,
        awayLogo: g.awayLogo,
        homeLogo: g.homeLogo,
        time: g.time,
        yourPlayers: [],
      })),
      totalYourPlayers: 0,
    });
  }

  const { data: drafts } = await supabase
    .from('drafts')
    .select('id')
    .eq('admin_user_id', user.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: participations } = await supabase
    .from('draft_participants')
    .select('draft_id')
    .eq('user_id', user.id);

  const participatedDraftIds = new Set((participations || []).map(p => p.draft_id));
  let draftId: string | null = null;

  if (drafts && drafts.length > 0) {
    draftId = drafts[0].id;
  } else if (participatedDraftIds.size > 0) {
    const { data: joinedDrafts } = await supabase
      .from('drafts')
      .select('id')
      .in('id', [...participatedDraftIds])
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1);
    draftId = joinedDrafts?.[0]?.id || null;
  }

  if (!draftId) {
    return NextResponse.json({
      games: tonightGames.map(g => ({
        away: g.away,
        home: g.home,
        awayLogo: g.awayLogo,
        homeLogo: g.homeLogo,
        time: g.time,
        yourPlayers: [],
      })),
      totalYourPlayers: 0,
    });
  }

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll() { return []; }, setAll() {} },
    }
  );

  const { data: myParticipant } = await adminClient
    .from('draft_participants')
    .select('id')
    .eq('draft_id', draftId)
    .eq('user_id', user.id)
    .limit(1);

  if (!myParticipant || myParticipant.length === 0) {
    return NextResponse.json({
      games: tonightGames.map(g => ({
        away: g.away,
        home: g.home,
        awayLogo: g.awayLogo,
        homeLogo: g.homeLogo,
        time: g.time,
        yourPlayers: [],
      })),
      totalYourPlayers: 0,
    });
  }

  const [picksResult, playersResult] = await Promise.all([
    adminClient.from('draft_picks').select('player_id').eq('draft_id', draftId).eq('participant_id', myParticipant[0].id),
    adminClient.from('players').select('id, name, team, position'),
  ]);

  const myPlayerIds = new Set((picksResult.data || []).map(p => p.player_id));
  const playerMap = new Map<string, { name: string; team: string; position: string }>();
  for (const p of playersResult.data || []) {
    playerMap.set(p.id, { name: p.name, team: p.team, position: p.position });
  }

  const tonightTeams = new Set(tonightGames.flatMap(g => [g.away, g.home]));
  const rosteredByTeam = new Map<string, Array<{ playerName: string; position: string }>>();
  for (const playerId of myPlayerIds) {
    const player = playerMap.get(playerId);
    if (!player || !tonightTeams.has(player.team)) continue;
    if (!rosteredByTeam.has(player.team)) rosteredByTeam.set(player.team, []);
    rosteredByTeam.get(player.team)!.push({ playerName: player.name, position: player.position });
  }

  let totalYourPlayers = 0;
  const games = tonightGames.map(g => {
    const awayPlayers = rosteredByTeam.get(g.away) || [];
    const homePlayers = rosteredByTeam.get(g.home) || [];
    const yourPlayers = [...awayPlayers, ...homePlayers];
    totalYourPlayers += yourPlayers.length;
    return {
      away: g.away,
      home: g.home,
      awayLogo: g.awayLogo,
      homeLogo: g.homeLogo,
      time: g.time,
      yourPlayers,
    };
  });

  return NextResponse.json({ games, totalYourPlayers });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/app/api/games/route.ts
git commit -m "add /api/games endpoint with rostered player info"
```

---

### Task 3: Rewrite dashboard page (`page.tsx`)

**Files:**
- Modify: `app/src/app/page.tsx`

This replaces the current "My Drafts" list with the command center widgets when a complete draft exists. Falls back to the existing draft list when no complete draft.

- [ ] **Step 1: Rewrite `app/src/app/page.tsx`**

Replace the entire file with the command center implementation. The file should:

1. Keep the unauthenticated hero view (lines 68-94 of current file) unchanged
2. Add `useAuth` import, `useState`, `useEffect`, `useCallback`
3. Add `TeamLogo` import from `@/components/TeamLogo`
4. Add `Link` import from `next/link`
5. On mount, fetch `GET /api/dashboard`
6. If `draft` is null, render the existing draft list UI (admin drafts + joined drafts, fetched from `GET /api/drafts`)
7. If `draft` exists, render the command center with these sections:

**Draft Status Bar** (full width):
- Draft name (large)
- Rank badge: "3rd of 10 teams"
- Season type / round info

**My Team Widget** (full width):
- Header: "My Team" label + "N pts total | +N yesterday | View team →"
- Responsive grid of player cards (5 col desktop, 3 tablet, 2 mobile)
- Each card: `<TeamLogo team={player.team} className="w-6 h-6" />`, player name, position + team abbrev
- Yesterday points: green "+N pts" or muted "—"
- Injury badge: DTD (orange text "DAY-TO-DAY"), OUT (red text "OUT"), ELIMINATED (red, dimmed card with line-through on name)
- "View team →" links to `/draft/${draft.id}/team`

**Standings Snapshot** (half width):
- Top 5 table with rank, team name, points
- User's row highlighted with green background
- "View full standings →" links to `/draft/${draft.id}/standings`

**Tonight's Games** (half width):
- Each game: away logo + abbrev, "@", home logo + abbrev, time
- "N of your players in action" count
- "View all games →" links to `/games`

**Roster Alerts** (half width):
- Only show if roster has injured/eliminated players
- Each alert: badge (OUT/DTD/ELIM), team logo, player name, description
- ELIM players: dimmed + strikethrough

**Teams Eliminated** (half width):
- Grid of eliminated team logos (dimmed, strikethrough abbrev below each)
- Count: "N of N playoff teams eliminated"
- Uses `<TeamLogo>` component

**Quick Actions** (full width):
- 4 buttons: My Team (filled green), Standings, Rankings, Bracket (outlined)
- Links: `/draft/${draft.id}/team`, `/draft/${draft.id}/standings`, `/rankings`, `/bracket`

Color scheme: bg `#050a05`, cards `#0a0f0a`, borders `#1a2f1a`, text `#c8d9c3`, muted `#5a6b57`, accent `#4a7c59`, highlight `#6b9b7a`.

- [ ] **Step 2: Verify build**

```bash
cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/page.tsx
git commit -m "rewrite dashboard as command center with live widgets"
```

---

### Task 4: Create `/games` page

**Files:**
- Create: `app/src/app/games/page.tsx`

- [ ] **Step 1: Create the games page**

Create `app/src/app/games/page.tsx` as a `'use client'` component:

1. Fetch `GET /api/games` on mount
2. Page header: "Tonight's Games" (uppercase muted label), date (large bold), subtitle "N games · N of your players in action"
3. Back link: "← Dashboard" linking to `/`
4. For each game, render a card:
   - **Matchup section**: centered row with away team logo (48px) + abbrev, "@", home team logo (48px) + abbrev
   - **Game time**: centered below matchup
   - **Divider**: `border-t border-[#1a2f1a]`
   - **Your Players section**: if `yourPlayers.length > 0`, show "Your Players" label + list with team logo (18px via TeamLogo), name, position. If empty, show "No rostered players in this game" muted.
5. If no games: "No games scheduled tonight" centered
6. If not authenticated (detected by `totalYourPlayers === 0` and no user): show sign-in CTA
7. Use `TeamLogo` component for all team logos
8. Mobile: cards full width, logos shrink to 36px

- [ ] **Step 2: Verify build**

```bash
cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/games/page.tsx
git commit -m "add /games page with tonight's NHL schedule and rostered players"
```

---

### Task 5: Add Games link to Navigation

**Files:**
- Modify: `app/src/components/Navigation.tsx`

- [ ] **Step 1: Add Games nav link**

In `app/src/components/Navigation.tsx`, add a "Games" link in the nav alongside Dashboard, Rankings, and Bracket. Add it after Bracket:

Desktop nav (inside the existing nav links section):
```tsx
<Link href="/games" className="...">Games</Link>
```

Mobile nav (inside the hamburger menu):
```tsx
<Link href="/games" className="...">Games</Link>
```

Match the exact same classes/styles as the existing Bracket link.

- [ ] **Step 2: Verify build**

```bash
cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/Navigation.tsx
git commit -m "add Games link to navigation"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Final commit if any fixes needed**
