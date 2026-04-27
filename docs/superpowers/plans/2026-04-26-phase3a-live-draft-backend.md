# Phase 3a: Live Draft Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database columns, API routes, and a Realtime subscription hook needed for the live multi-user draft.

**Architecture:** Two new columns on `drafts` table for pick_entry_mode and timer. Three new API routes under `/api/drafts/[id]/` for starting the draft, making picks, and undoing picks. A reusable React hook `useDraftRealtime` that all draft pages will use to subscribe to pick changes.

**Tech Stack:** Next.js 15 App Router, Supabase (server client + Realtime), TypeScript

---

## File Structure

### New Files
- `supabase/migrations/002_live_draft_columns.sql` — Add pick_entry_mode and pick_timer_seconds to drafts
- `app/src/app/api/drafts/[id]/start/route.ts` — POST: start the draft (assign positions, set status)
- `app/src/app/api/drafts/[id]/picks/route.ts` — POST: make a pick; GET: list picks
- `app/src/app/api/drafts/[id]/picks/last/route.ts` — DELETE: undo last pick
- `app/src/hooks/useDraftRealtime.ts` — Hook for subscribing to draft_picks changes
- `app/src/hooks/useDraftState.ts` — Hook for loading and managing full draft state (picks, participants, players)

### Modified Files
- `app/src/app/api/drafts/[id]/route.ts` — Also return picks and participants in GET response

---

### Task 1: Database Migration for Live Draft Columns

**Files:**
- Create: `supabase/migrations/002_live_draft_columns.sql`

- [ ] **Step 1: Create the migration SQL**

Write `supabase/migrations/002_live_draft_columns.sql`:

```sql
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS pick_entry_mode TEXT NOT NULL DEFAULT 'admin_only'
  CHECK (pick_entry_mode IN ('admin_only', 'self_draft'));
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS pick_timer_seconds INTEGER;

-- Enable Realtime for draft_picks table
ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;
```

- [ ] **Step 2: Run the migration in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → New Query → paste the SQL → Run.
Expected: Both columns added, Realtime enabled on draft_picks.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_live_draft_columns.sql
git commit -m "feat: add pick_entry_mode and pick_timer_seconds columns, enable Realtime on draft_picks"
```

---

### Task 2: Start Draft API Route

**Files:**
- Create: `app/src/app/api/drafts/[id]/start/route.ts`

First: `mkdir -p app/src/app/api/drafts/\[id\]/start`

- [ ] **Step 1: Create the start draft route**

Write `app/src/app/api/drafts/[id]/start/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });
  }

  if (draft.status === 'in_progress') {
    return NextResponse.json({ error: 'Draft already in progress' }, { status: 400 });
  }

  if (draft.status === 'complete') {
    return NextResponse.json({ error: 'Draft is complete' }, { status: 400 });
  }

  const body = await request.json();
  const { positions, pick_entry_mode, pick_timer_seconds } = body;

  if (!positions || !Array.isArray(positions)) {
    return NextResponse.json({ error: 'positions array required' }, { status: 400 });
  }

  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );

  const { data: participants } = await supabase
    .from('draft_participants')
    .select('id, user_id')
    .eq('draft_id', id);

  if (!participants || participants.length === 0) {
    return NextResponse.json({ error: 'No participants registered' }, { status: 400 });
  }

  const adminParticipant = participants.find(p => p.user_id === user.id);

  if (!adminParticipant) {
    const { data: newParticipant, error: createError } = await adminClient
      .from('draft_participants')
      .insert({
        draft_id: id,
        user_id: user.id,
        team_name: 'Commissioner',
      })
      .select('id, user_id')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    participants.push(newParticipant);
  }

  for (const pos of positions) {
    const { participant_id, draft_position } = pos;
    if (!participant_id || draft_position == null) continue;

    await adminClient
      .from('draft_participants')
      .update({ draft_position })
      .eq('id', participant_id)
      .eq('draft_id', id);
  }

  const { error: updateError } = await adminClient
    .from('drafts')
    .update({
      status: 'in_progress',
      current_round: 1,
      current_pick: 1,
      pick_entry_mode: pick_entry_mode || 'admin_only',
      pick_timer_seconds: pick_timer_seconds || null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/drafts/
git commit -m "feat: add start draft API route (assign positions, set in_progress)"
```

---

### Task 3: Make Pick API Route

**Files:**
- Create: `app/src/app/api/drafts/[id]/picks/route.ts`

First: `mkdir -p app/src/app/api/drafts/\[id\]/picks`

- [ ] **Step 1: Create the picks API route**

Write `app/src/app/api/drafts/[id]/picks/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: picks, error } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('draft_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ picks: picks || [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (!draft || draft.status !== 'in_progress') {
    return NextResponse.json({ error: 'Draft is not in progress' }, { status: 400 });
  }

  const body = await request.json();
  const { participant_id, player_id, player_name } = body;

  if (!participant_id || !player_id || !player_name) {
    return NextResponse.json({ error: 'participant_id, player_id, and player_name required' }, { status: 400 });
  }

  const { data: existingPick } = await supabase
    .from('draft_picks')
    .select('id')
    .eq('draft_id', id)
    .eq('player_id', player_id)
    .maybeSingle();

  if (existingPick) {
    return NextResponse.json({ error: 'Player already drafted' }, { status: 409 });
  }

  const { data: participant } = await supabase
    .from('draft_participants')
    .select('id, user_id, draft_position')
    .eq('id', participant_id)
    .eq('draft_id', id)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  const isParticipant = participant.user_id === user.id;
  const { data: draftForAdmin } = await supabase
    .from('drafts')
    .select('admin_user_id')
    .eq('id', id)
    .single();
  const isAdmin = draftForAdmin?.admin_user_id === user.id;

  if (!isAdmin && !isParticipant) {
    return NextResponse.json({ error: 'Not authorized to pick' }, { status: 403 });
  }

  if (draft.pick_entry_mode === 'admin_only' && !isAdmin) {
    return NextResponse.json({ error: 'Only admin can make picks in this mode' }, { status: 403 });
  }

  const totalPicks = draft.players_per_team * (await supabase
    .from('draft_participants')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', id)).count!;

  const { count: currentPickCount } = await supabase
    .from('draft_picks')
    .select('*', { count: 'exact', head: true })
    .eq('draft_id', id);

  if ((currentPickCount || 0) >= totalPicks) {
    return NextResponse.json({ error: 'Draft is complete' }, { status: 400 });
  }

  const managers = (await supabase
    .from('draft_participants')
    .select('id')
    .eq('draft_id', id))
    .data?.length || 0;

  const currentRound = draft.current_round;
  const currentPick = draft.current_pick;
  const isReverseRound = currentRound % 2 === 0;
  const order = Array.from({ length: managers }, (_, i) =>
    isReverseRound ? managers - i : i + 1
  );
  const currentManagerPosition = order[currentPick - 1];

  if (!isAdmin && participant.draft_position !== currentManagerPosition) {
    return NextResponse.json({ error: 'Not your turn' }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from('draft_picks')
    .insert({
      draft_id: id,
      round: currentRound,
      pick_number: (currentRound - 1) * managers + currentPick,
      manager_index: participant.draft_position!,
      participant_id,
      player_id,
      player_name,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  let newRound = currentRound;
  let newPick = currentPick + 1;
  if (newPick > managers) {
    newRound += 1;
    newPick = 1;
  }

  const isDraftComplete = (currentPickCount || 0) + 1 >= totalPicks;

  await supabase
    .from('drafts')
    .update({
      current_round: isDraftComplete ? draft.players_per_team + 1 : newRound,
      current_pick: isDraftComplete ? 0 : newPick,
      status: isDraftComplete ? 'complete' : 'in_progress',
    })
    .eq('id', id);

  return NextResponse.json({ success: true, draft_complete: isDraftComplete });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/drafts/
git commit -m "feat: add picks API route (POST make pick, GET list picks)"
```

---

### Task 4: Undo Pick API Route

**Files:**
- Create: `app/src/app/api/drafts/[id]/picks/last/route.ts`

First: `mkdir -p app/src/app/api/drafts/\[id\]/picks/last`

- [ ] **Step 1: Create the undo last pick route**

Write `app/src/app/api/drafts/[id]/picks/last/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: draft } = await supabase
    .from('drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (!draft || draft.admin_user_id !== user.id) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  if (draft.status !== 'in_progress') {
    return NextResponse.json({ error: 'Draft is not in progress' }, { status: 400 });
  }

  const { data: picks } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('draft_id', id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!picks || picks.length === 0) {
    return NextResponse.json({ error: 'No picks to undo' }, { status: 400 });
  }

  const lastPick = picks[0];

  await supabase
    .from('draft_picks')
    .delete()
    .eq('id', lastPick.id);

  const managers = (await supabase
    .from('draft_participants')
    .select('id')
    .eq('draft_id', id))
    .data?.length || 0;

  let prevRound = draft.current_round;
  let prevPick = draft.current_pick - 1;

  if (prevPick < 1) {
    prevRound -= 1;
    prevPick = managers;
  }

  if (prevRound < 1) {
    prevRound = 1;
    prevPick = 1;
  }

  await supabase
    .from('drafts')
    .update({
      current_round: prevRound,
      current_pick: prevPick,
      status: 'in_progress',
    })
    .eq('id', id);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/drafts/
git commit -m "feat: add undo last pick API route (admin-only DELETE)"
```

---

### Task 5: Update Draft Detail GET Route to Include Picks

**Files:**
- Modify: `app/src/app/api/drafts/[id]/route.ts`

- [ ] **Step 1: Add picks to the GET response**

In `app/src/app/api/drafts/[id]/route.ts`, after the participants query (around line 30), add a picks query:

```typescript
  const { data: picks } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('draft_id', id)
    .order('created_at', { ascending: true });
```

And include it in the response JSON:

```typescript
  return NextResponse.json({
    draft,
    invites: invites || [],
    participants: participants || [],
    picks: picks || [],
    is_admin: draft.admin_user_id === user.id,
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/drafts/[id]/route.ts
git commit -m "feat: include draft picks in draft detail GET response"
```

---

### Task 6: Create useDraftRealtime Hook

**Files:**
- Create: `app/src/hooks/useDraftRealtime.ts`

First: `mkdir -p app/src/hooks`

- [ ] **Step 1: Create the Realtime subscription hook**

Write `app/src/hooks/useDraftRealtime.ts`:

```typescript
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface DraftPickRow {
  id: string;
  draft_id: string;
  round: number;
  pick_number: number;
  manager_index: number;
  participant_id: string;
  player_id: string;
  player_name: string;
  created_at: string;
}

interface UseDraftRealtimeProps {
  draftId: string;
  onPickAdded?: (pick: DraftPickRow) => void;
  onPickRemoved?: (pickId: string) => void;
}

export function useDraftRealtime({ draftId, onPickAdded, onPickRemoved }: UseDraftRealtimeProps) {
  const channelRef = useRef<ReturnType<typeof createClient>['channel'] | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`draft:${draftId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'draft_picks',
          filter: `draft_id=eq.${draftId}`,
        },
        (payload) => {
          if (onPickAdded) {
            onPickAdded(payload.new as DraftPickRow);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'draft_picks',
          filter: `draft_id=eq.${draftId}`,
        },
        (payload) => {
          if (onPickRemoved) {
            onPickRemoved((payload.old as { id: string }).id);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [draftId, onPickAdded, onPickRemoved]);

  return { channel: channelRef.current };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/hooks/useDraftRealtime.ts
git commit -m "feat: add useDraftRealtime hook for Supabase Realtime subscriptions"
```

---

### Task 7: Create useDraftState Hook

**Files:**
- Create: `app/src/hooks/useDraftState.ts`

- [ ] **Step 1: Create the draft state management hook**

This hook loads all draft data (draft, participants, picks, players) and keeps it updated via Realtime.

Write `app/src/hooks/useDraftState.ts`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDraftRealtime, DraftPickRow } from './useDraftRealtime';
import { Player } from '@/types/player';

export interface DraftData {
  id: string;
  name: string;
  season_type: string;
  status: string;
  draft_date: string | null;
  draft_time: string | null;
  location: string | null;
  entry_fee: number;
  currency: string;
  payment_method: string | null;
  payment_info: string | null;
  notes: string | null;
  players_per_team: number;
  scoring_format: string;
  pick_entry_mode: string;
  pick_timer_seconds: number | null;
  admin_user_id: string;
  current_round: number;
  current_pick: number;
}

export interface ParticipantData {
  id: string;
  user_id: string;
  team_name: string;
  draft_position: number | null;
  has_paid: boolean;
  created_at: string;
}

export function useDraftState(draftId: string) {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [picks, setPicks] = useState<DraftPickRow[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchDraft = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const [draftRes, participantsRes, picksRes, playersRes] = await Promise.all([
      fetch(`/api/drafts/${draftId}`),
      Promise.resolve(supabase.from('draft_participants').select('id, user_id, team_name, draft_position, has_paid, created_at').eq('draft_id', draftId).order('created_at', { ascending: true })),
      supabase.from('draft_picks').select('*').eq('draft_id', draftId).order('created_at', { ascending: true }),
      supabase.from('players').select('*').order('projected_playoff_points', { ascending: false }),
    ]);

    const draftData = await draftRes.json();
    if (draftData.draft) {
      setDraft(draftData.draft as DraftData);
      setIsAdmin(draftData.is_admin);
    }

    if (draftData.participants) {
      setParticipants(draftData.participants);
    } else if (participantsRes.data) {
      setParticipants(participantsRes.data as ParticipantData[]);
    }

    if (picksRes.data) {
      setPicks(picksRes.data as DraftPickRow[]);
    }

    if (playersRes.data) {
      setPlayers(playersRes.data.map(mapPlayerRow));
    }

    setLoading(false);
  }, [draftId]);

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  const handlePickAdded = useCallback((pick: DraftPickRow) => {
    setPicks(prev => {
      if (prev.some(p => p.id === pick.id)) return prev;
      return [...prev, pick];
    });
    fetchDraft();
  }, [fetchDraft]);

  const handlePickRemoved = useCallback((pickId: string) => {
    setPicks(prev => prev.filter(p => p.id !== pickId));
    fetchDraft();
  }, [fetchDraft]);

  useDraftRealtime({
    draftId,
    onPickAdded: handlePickAdded,
    onPickRemoved: handlePickRemoved,
  });

  const draftedPlayerIds = new Set(picks.map(p => p.player_id));
  const availablePlayers = players.filter(p => !draftedPlayerIds.has(playerToId(p.name)));

  const managers = participants.length;
  const currentRound = draft?.current_round ?? 1;
  const currentPick = draft?.current_pick ?? 1;
  const isReverseRound = currentRound % 2 === 0;
  const order = Array.from({ length: managers }, (_, i) =>
    isReverseRound ? managers - i : i + 1
  );
  const currentPosition = order[currentPick - 1] ?? 1;
  const currentParticipant = participants.find(p => p.draft_position === currentPosition);
  const isDraftComplete = draft?.status === 'complete' || (currentRound > (draft?.players_per_team ?? 10));

  return {
    draft,
    participants,
    picks,
    players,
    availablePlayers,
    loading,
    isAdmin,
    currentUserId,
    managers,
    currentRound,
    currentPick,
    currentPosition,
    currentParticipant,
    isDraftComplete,
    refresh: fetchDraft,
  };
}

function playerToId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function mapPlayerRow(row: Record<string, unknown>): Player {
  return {
    name: row.name as string,
    team: row.team as string,
    position: row.position as Player['position'],
    regularSeasonGoals: row.regular_season_goals as number,
    regularSeasonAssists: row.regular_season_assists as number,
    gamesPlayed: row.games_played as number,
    pointsPerGame: row.points_per_game as number,
    last10Games: row.last_10_games != null
      ? { goals: row.last_10_goals as number, assists: row.last_10_assists as number, points: (row.last_10_goals as number) + (row.last_10_assists as number), games: row.last_10_games as number }
      : undefined,
    last20Games: row.last_20_games != null
      ? { goals: row.last_20_goals as number, assists: row.last_20_assists as number, points: (row.last_20_goals as number) + (row.last_20_assists as number), games: row.last_20_games as number }
      : undefined,
    teamAdvancementOdds: {
      round1: row.team_advancement_r1 as number,
      round2: row.team_advancement_r2 as number,
      round3: row.team_advancement_r3 as number,
      round4: row.team_advancement_r4 as number,
    },
    projectedPlayoffGames: row.projected_playoff_games as number,
    projectedPlayoffPoints: row.projected_playoff_points as number,
    rank: row.rank as number,
    adp: (row.adp as number) ?? undefined,
    injury: {
      status: row.injury_status as Player['injury']['status'],
      expectedReturn: row.injury_expected_return as string | null,
      description: row.injury_description as string | null,
    },
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/src/hooks/useDraftState.ts
git commit -m "feat: add useDraftState hook for loading and managing full draft state"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 2: Run build**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `cd /Users/brandon.nolan/development/hockey-fantasy/app && npm run lint`
Expected: Only warnings (no errors)
