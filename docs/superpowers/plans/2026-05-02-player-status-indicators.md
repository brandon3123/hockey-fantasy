# Player Status Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add injury and playoff elimination status indicators to post-draft standings and roster views.

**Architecture:** Enrich standings/results API responses at the API layer by fetching ESPN injuries JSON API and NHL playoff bracket API. Match injuries to drafted players by name. Display InjuryFlag badges and strikethrough styling on frontend.

**Tech Stack:** Next.js API routes, ESPN Injuries JSON API, NHL Playoff Bracket API, existing InjuryFlag component, Tailwind CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/src/lib/nhl-api.ts` | Modify | Add `fetchEspnInjuries()` and `fetchActivePlayoffTeams()` with caching |
| `app/src/app/api/drafts/[id]/standings/route.ts` | Modify | Enrich RosterPlayer with injury + elimination data |
| `app/src/app/draft/[id]/standings/page.tsx` | Modify | Add InjuryFlag badges, strikethrough for eliminated |
| `app/src/app/draft/[id]/results/page.tsx` | Modify | Add InjuryFlag badges, strikethrough for eliminated |
| `docs/superpowers/specs/2026-05-02-player-status-indicators-design.md` | Already exists | Design spec |

---

### Task 1: Add ESPN injuries fetcher with cache to nhl-api.ts

**Files:**
- Modify: `app/src/lib/nhl-api.ts`

- [ ] **Step 1: Add ESPN injury types and cache**

Add at the top of `nhl-api.ts` after the existing interfaces:

```typescript
interface EspnInjuryAthlete {
  displayName: string;
}

interface EspnInjuryEntry {
  status: string;
  shortComment: string;
  date: string;
  athlete: EspnInjuryAthlete;
}

interface EspnInjuryTeam {
  displayName: string;
  injuries: EspnInjuryEntry[];
}

interface EspnInjuriesResponse {
  injuries: EspnInjuryTeam[];
}

interface InjuryInfo {
  status: "healthy" | "day-to-day" | "week-to-week" | "out indefinitely" | "out for playoffs";
  description: string | null;
}
```

Add cache variables after the interfaces:

```typescript
let espnInjuriesCache: { data: Map<string, InjuryInfo>; timestamp: number } | null = null;
const ESPN_INJURIES_TTL = 10 * 60 * 1000;

let playoffTeamsCache: { data: Set<string>; timestamp: number } | null = null;
const PLAYOFF_TEAMS_TTL = 30 * 60 * 1000;
```

- [ ] **Step 2: Add fetchEspnInjuries function**

Add at the bottom of `nhl-api.ts`:

```typescript
export async function fetchEspnInjuries(): Promise<Map<string, InjuryInfo>> {
  if (espnInjuriesCache && Date.now() - espnInjuriesCache.timestamp < ESPN_INJURIES_TTL) {
    return espnInjuriesCache.data;
  }

  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries");
    if (!res.ok) throw new Error(`ESPN injuries API error: ${res.status}`);
    const data: EspnInjuriesResponse = await res.json();

    const injuryMap = new Map<string, InjuryInfo>();

    for (const team of data.injuries || []) {
      for (const injury of team.injuries || []) {
        const statusCol = injury.status;
        const comment = injury.shortComment || null;
        const playerName = injury.athlete?.displayName;
        if (!playerName) continue;

        let injuryStatus: InjuryInfo["status"] = "week-to-week";
        if (statusCol === "Day-To-Day") {
          injuryStatus = "day-to-day";
        } else if (statusCol === "Injured Reserve") {
          injuryStatus = "out indefinitely";
        } else if (statusCol === "Out") {
          injuryStatus = "out indefinitely";
        }

        injuryMap.set(playerName.toLowerCase(), {
          status: injuryStatus,
          description: comment,
        });
      }
    }

    espnInjuriesCache = { data: injuryMap, timestamp: Date.now() };
    return injuryMap;
  } catch {
    return espnInjuriesCache?.data ?? new Map();
  }
}
```

- [ ] **Step 3: Add fetchActivePlayoffTeams function**

Add after `fetchEspnInjuries`:

```typescript
export async function fetchActivePlayoffTeams(): Promise<Set<string>> {
  if (playoffTeamsCache && Date.now() - playoffTeamsCache.timestamp < PLAYOFF_TEAMS_TTL) {
    return playoffTeamsCache.data;
  }

  try {
    const res = await fetch("https://api-web.nhle.com/v1/playoff-bracket/2026");
    if (!res.ok) throw new Error(`NHL bracket API error: ${res.status}`);
    const data = await res.json();

    const activeTeams = new Set<string>();
    for (const series of data.series || []) {
      const top = series.topSeedTeam;
      const bottom = series.bottomSeedTeam;
      if (top && top.abbrev && top.abbrev !== "TBD") {
        activeTeams.add(top.abbrev);
      }
      if (bottom && bottom.abbrev && bottom.abbrev !== "TBD") {
        activeTeams.add(bottom.abbrev);
      }
    }

    playoffTeamsCache = { data: activeTeams, timestamp: Date.now() };
    return activeTeams;
  } catch {
    return playoffTeamsCache?.data ?? new Set();
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/nhl-api.ts
git commit -m "add ESPN injuries fetcher and NHL playoff bracket fetcher with caching"
```

---

### Task 2: Enrich standings API with injury + elimination data

**Files:**
- Modify: `app/src/app/api/drafts/[id]/standings/route.ts`

- [ ] **Step 1: Add imports for new functions**

Add to the imports at the top of the file:

```typescript
import { fetchTonightGames, fetchEspnInjuries, fetchActivePlayoffTeams } from '@/lib/nhl-api';
```

(Remove the existing `fetchTonightGames` import and replace with this line that includes all three.)

- [ ] **Step 2: Add injury + elimination enrichment after playerMap is built**

After line 54 (`playerMap.set(p.id, { name: p.name, team: p.team, position: p.position });`) and before the scores processing, add the enrichment fetches:

```typescript
  const [espnInjuries, activePlayoffTeams] = await Promise.all([
    fetchEspnInjuries(),
    fetchActivePlayoffTeams(),
  ]);
```

- [ ] **Step 3: Update RosterPlayer to include injury + elimination fields**

In the roster mapping (around line 107-117), update the return object to include new fields:

Replace the existing return block:
```typescript
      return {
        playerId: pick.player_id,
        playerName: playerInfo.name,
        team: playerInfo.team,
        position: playerInfo.position,
        round: pick.round,
        goals: totalGoals,
        assists: totalAssists,
        points: totalPoints,
        gamesPlayed,
      };
```

With:
```typescript
      const injuryInfo = espnInjuries.get(playerInfo.name.toLowerCase());
      const isEliminated = activePlayoffTeams.size > 0 && playerInfo.team && !activePlayoffTeams.has(playerInfo.team);

      return {
        playerId: pick.player_id,
        playerName: playerInfo.name,
        team: playerInfo.team,
        position: playerInfo.position,
        round: pick.round,
        goals: totalGoals,
        assists: totalAssists,
        points: totalPoints,
        gamesPlayed,
        injuryStatus: injuryInfo?.status ?? "healthy",
        injuryDescription: injuryInfo?.description ?? null,
        isEliminated,
      };
```

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/drafts/[id]/standings/route.ts
git commit -m "enrich standings API with ESPN injury data and playoff elimination status"
```

---

### Task 3: Update standings page frontend

**Files:**
- Modify: `app/src/app/draft/[id]/standings/page.tsx`

- [ ] **Step 1: Update RosterPlayer interface**

Replace the existing `RosterPlayer` interface (lines 16-26) with:

```typescript
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
  injuryStatus: "healthy" | "day-to-day" | "week-to-week" | "out indefinitely" | "out for playoffs";
  injuryDescription: string | null;
  isEliminated: boolean;
}
```

- [ ] **Step 2: Update roster row rendering**

Replace the roster row rendering block (around lines 344-375, the `s.roster.sort(...).map(...)` block) with:

```tsx
{s.roster
  .sort((a, b) => a.round - b.round)
  .map((p) => {
    const isOut = p.injuryStatus === "out indefinitely" || p.injuryStatus === "out for playoffs";
    const isInactive = isOut || p.isEliminated;
    const injuryLabel =
      p.injuryStatus === "day-to-day" ? "DTD" :
      p.injuryStatus === "week-to-week" ? "WTW" :
      (p.injuryStatus === "out indefinitely" || p.injuryStatus === "out for playoffs") ? "OUT" : null;
    const injuryBadgeColor =
      p.injuryStatus === "day-to-day" ? "bg-[#854d0e] text-[#fbbf24]" :
      p.injuryStatus === "week-to-week" ? "bg-[#9a3412] text-[#fb923c]" :
      "bg-[#7f1d1d] text-[#fca5a5]";

    return (
      <div
        key={p.playerId}
        className={`flex items-center justify-between text-xs py-1 ${isInactive ? "opacity-40" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#5a6b57] w-5 text-right">
            {p.round}
          </span>
          <TeamLogo team={p.team} className="w-4 h-4" />
          <span
            className={`font-medium ${p.isEliminated ? "text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2" : "text-[#c8d9c3]"}`}
          >
            {p.playerName}
          </span>
          <span className="text-[#5a6b57]">{p.position}</span>
          {injuryLabel && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${injuryBadgeColor}`}>
              {injuryLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#6b9b7a] font-bold">
            {p.points.toFixed(1)}
          </span>
          <span className="text-[#5a6b57] w-6 text-right">
            {p.goals}G
          </span>
          <span className="text-[#5a6b57] w-6 text-right">
            {p.assists}A
          </span>
          <span className="text-[#2d3c28] w-6 text-right">
            {p.gamesPlayed}GP
          </span>
        </div>
      </div>
    );
  })}
```

- [ ] **Step 3: Update tonight's games player expansion to show injuries**

In the `getDraftedPlayersForGame` function, update the return type to include injury data. Find the function (around line 59-75) and update the roster lookup. Replace the function and its interface:

```typescript
interface DraftedPlayerInfo {
  playerName: string;
  position: string;
  team: string;
  injuryStatus: RosterPlayer["injuryStatus"];
}

function getDraftedPlayersForGame(
  game: TonightGame,
  standings: StandingEntry[],
  currentUserId: string | null
): DraftedPlayerInfo[] {
  const players: DraftedPlayerInfo[] = [];
  const myTeam = currentUserId
    ? standings.find((s) => s.userId === currentUserId)
    : null;
  if (!myTeam) return players;
  for (const p of myTeam.roster) {
    if (p.team === game.home || p.team === game.away) {
      players.push({ playerName: p.playerName, position: p.position, team: p.team, injuryStatus: p.injuryStatus });
    }
  }
  return players;
}
```

Then in the tonight's games expansion rendering (around lines 226-239), update the player display to show injury badges:

Replace the existing expansion block that renders drafted players:
```tsx
{isExpanded && hasPlayers && (
  <div className="border-t border-[#141e12] mt-2 pt-2">
    {draftedPlayers.map((p, i) => {
      const injuryLabel =
        p.injuryStatus === "day-to-day" ? "DTD" :
        p.injuryStatus === "week-to-week" ? "WTW" :
        (p.injuryStatus === "out indefinitely" || p.injuryStatus === "out for playoffs") ? "OUT" : null;
      const injuryBadgeColor =
        p.injuryStatus === "day-to-day" ? "bg-[#854d0e] text-[#fbbf24]" :
        p.injuryStatus === "week-to-week" ? "bg-[#9a3412] text-[#fb923c]" :
        "bg-[#7f1d1d] text-[#fca5a5]";

      return (
        <div
          key={`${p.playerName}-${p.team}-${i}`}
          className="flex items-center gap-1.5 py-0.5"
        >
          <TeamLogo team={p.team} className="w-3.5 h-3.5" />
          <span className="text-[10px] text-[#c8d9c3]">{p.playerName}</span>
          <span className="text-[10px] text-[#5a6b57]">{p.position}</span>
          {injuryLabel && (
            <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${injuryBadgeColor}`}>
              {injuryLabel}
            </span>
          )}
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/src/app/draft/[id]/standings/page.tsx
git commit -m "add injury and elimination indicators to standings roster display"
```

---

### Task 4: Update results page frontend

**Files:**
- Modify: `app/src/app/draft/[id]/results/page.tsx`

- [ ] **Step 1: The results page uses `useDraftState` hook which loads from `players.json`**

The results page gets player data from `useDraftState` which reads the static `players.json`. It doesn't call the standings API. We need to add injury data to this page.

First, check if `useDraftState` provides injury data. Read `app/src/hooks/useDraftState.ts` and check the Player type — it already has `injury` from the `Player` type in `types/player.ts`. So the results page already has injury data from the static players.json.

We need to add a separate fetch for the ESPN injuries to get **live** data. Add a useEffect to fetch live injuries and a fetch for playoff bracket.

Add these imports at the top:

```typescript
import { useState, useEffect, useMemo } from 'react';
```

(Update the existing `useMemo, useState` import to include `useEffect`.)

- [ ] **Step 2: Add live injury + elimination fetch inside ResultsPage**

Inside `export default function ResultsPage()`, after the existing hooks, add:

```typescript
  const [liveInjuries, setLiveInjuries] = useState<Map<string, { status: string; description: string | null }>>(new Map());
  const [eliminatedTeams, setEliminatedTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchLiveData() {
      try {
        const [injuriesRes, bracketRes] = await Promise.all([
          fetch('/api/live-injuries'),
          fetch('/api/playoff-bracket'),
        ]);
        if (injuriesRes.ok) {
          const injuriesData = await injuriesRes.json();
          const map = new Map<string, { status: string; description: string | null }>();
          for (const [name, info] of Object.entries(injuriesData)) {
            map.set(name, info as { status: string; description: string | null });
          }
          setLiveInjuries(map);
        }
        if (bracketRes.ok) {
          const bracketData = await bracketRes.json();
          const active = new Set<string>();
          for (const series of bracketData.series || []) {
            if (series.topSeedTeam?.abbrev && series.topSeedTeam.abbrev !== 'TBD') active.add(series.topSeedTeam.abbrev);
            if (series.bottomSeedTeam?.abbrev && series.bottomSeedTeam.abbrev !== 'TBD') active.add(series.bottomSeedTeam.abbrev);
          }
          if (active.size > 0) {
            const allTeams = new Set(standings.flatMap(s => s.roster.map(r => r.player.team)));
            const eliminated = new Set<string>();
            for (const team of allTeams) {
              if (team && !active.has(team)) eliminated.add(team);
            }
            setEliminatedTeams(eliminated);
          }
        }
      } catch {}
    }
    if (draft && isDraftComplete) fetchLiveData();
  }, [draft, isDraftComplete, standings]);
```

- [ ] **Step 3: Create the /api/live-injuries endpoint**

Create a new API route that wraps `fetchEspnInjuries`:

**Create:** `app/src/app/api/live-injuries/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { fetchEspnInjuries } from '@/lib/nhl-api';

export async function GET() {
  const injuries = await fetchEspnInjuries();
  const obj: Record<string, { status: string; description: string | null }> = {};
  injuries.forEach((info, name) => {
    obj[name] = info;
  });
  return NextResponse.json(obj);
}
```

- [ ] **Step 4: Update results page roster rendering to show injury + elimination**

Find the roster rendering in the "Team Rosters" section (around lines 325-339). Replace:

```tsx
<div className="px-4 py-2">
  {s.roster
    .sort((a, b) => a.round - b.round)
    .map((r) => (
      <div
        key={`${r.player.name}-${r.player.team}-${r.player.position}`}
        className="flex justify-between items-center py-2 border-b border-[#141e12] last:border-0"
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#5a6b57] w-6">R{r.round}</span>
          <TeamLogo team={r.player.team} className="w-5 h-5" />
          <span className="text-[#c8d9c3] font-semibold">{r.player.name}</span>
          <span className="text-[#5a6b57]">{r.player.position} &bull; {r.player.pointsPerGame.toFixed(2)} ppg</span>
        </div>
        <span className="text-[#6b9b7a] font-bold text-xs">{r.player.displayPoints.toFixed(1)}</span>
      </div>
    ))}
</div>
```

With:

```tsx
<div className="px-4 py-2">
  {s.roster
    .sort((a, b) => a.round - b.round)
    .map((r) => {
      const liveInjury = liveInjuries.get(r.player.name.toLowerCase());
      const injuryStatus = liveInjury?.status ?? r.player.injury.status;
      const isEliminated = eliminatedTeams.has(r.player.team);
      const isOut = injuryStatus === "out indefinitely" || injuryStatus === "out for playoffs";
      const isInactive = isOut || isEliminated;
      const injuryLabel =
        injuryStatus === "day-to-day" ? "DTD" :
        injuryStatus === "week-to-week" ? "WTW" :
        (injuryStatus === "out indefinitely" || injuryStatus === "out for playoffs") ? "OUT" : null;
      const injuryBadgeColor =
        injuryStatus === "day-to-day" ? "bg-[#854d0e] text-[#fbbf24]" :
        injuryStatus === "week-to-week" ? "bg-[#9a3412] text-[#fb923c]" :
        "bg-[#7f1d1d] text-[#fca5a5]";

      return (
        <div
          key={`${r.player.name}-${r.player.team}-${r.player.position}`}
          className={`flex justify-between items-center py-2 border-b border-[#141e12] last:border-0 ${isInactive ? "opacity-40" : ""}`}
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#5a6b57] w-6">R{r.round}</span>
            <TeamLogo team={r.player.team} className="w-5 h-5" />
            <span className={`font-semibold ${isEliminated ? "text-[#fca5a5] line-through decoration-[#fca5a5] decoration-2" : "text-[#c8d9c3]"}`}>
              {r.player.name}
            </span>
            <span className="text-[#5a6b57]">{r.player.position} &bull; {r.player.pointsPerGame.toFixed(2)} ppg</span>
            {injuryLabel && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${injuryBadgeColor}`}>
                {injuryLabel}
              </span>
            )}
          </div>
          <span className="text-[#6b9b7a] font-bold text-xs">{r.player.displayPoints.toFixed(1)}</span>
        </div>
      );
    })}
</div>
```

- [ ] **Step 5: Commit**

```bash
git add app/src/app/draft/[id]/results/page.tsx app/src/app/api/live-injuries/route.ts
git commit -m "add injury and elimination indicators to results page roster display"
```

---

### Task 5: Verify and deploy

- [ ] **Step 1: Run lint and typecheck**

```bash
cd app && npm run lint && npm run build
```

Expected: No errors

- [ ] **Step 2: Commit spec update**

```bash
git add docs/superpowers/specs/2026-05-02-player-status-indicators-design.md
git commit -m "update spec to use ESPN injuries JSON API instead of NHL API"
```

- [ ] **Step 3: Push to master**

```bash
git push origin master
```
