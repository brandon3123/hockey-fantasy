# Multi-User Draft & Season Scoring System Design

## Overview

Transform the existing single-user hockey fantasy draft app into a multi-user platform where an admin hosts drafts for 11-20 participants. The admin creates a draft, invites participants by email, runs a live snake draft (projected on TV + coach view on phone), and tracks scores throughout the regular season or playoffs.

## Approach

Single-App Multi-Role: one Next.js app with role-based access control. Admin sees full controls including draft coach; participants see read-only team views and searchable player lists. All state persists in Supabase (PostgreSQL).

## Tech Stack

- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS (existing)
- **Backend:** Vercel serverless functions
- **Database & Auth:** Supabase (PostgreSQL + Auth)
- **Auth Methods:** Google OAuth + email/password
- **Deployment:** Vercel free tier
- **Background Jobs:** Vercel Cron Jobs for nightly score updates
- **Scoring Data:** NHL Stats API (free, no auth required)

## User Flows

### Phase 1: Pre-Draft (Admin)

1. Admin logs in, creates a new draft with event details:
   - Draft name, date, time, location
   - Season type (playoffs or regular season)
   - Players per team, scoring format
   - Entry fee, currency, payment method, payment email/instructions, notes
2. Admin adds participant emails (all at once or incrementally)
3. Each participant receives an invitation email containing:
   - Event details (date, time, location)
   - Payment info (cost, method, where to send)
   - Admin's notes
   - Link to create an account
4. Participants click the link, sign up (Google OAuth or email/password), enter a team name
5. Admin dashboard shows registration status per participant, with resend invite option
6. Draft status progresses: `setup` -> `inviting` -> `in_progress` -> `complete`

### Phase 2: Draft Night

1. Admin confirms all participants are registered and starts the draft
2. **TV/Projector screen** — Full draft board (projected for everyone to see):
   - Snake draft grid with rounds across columns, managers down rows
   - Each pick cell shows: player name, team logo, position, injury flag
   - Current picker highlighted with "ON THE CLOCK" banner
   - Admin's row highlighted in green
   - Projected points totals per team
   - Styled identically to the existing DraftGrid component
3. **Admin's phone screen** — Draft Coach with tabbed interface:
   - Same 6 tabs as current app: Coach, Best, All, Stack, Pos, Visual
   - Coach tab: strategy selector, position balance toggle, team summary, top 3 recommendations with reasoning
   - Admin drafts on behalf of whoever is currently picking
   - Undo/reset controls
4. **Participant's phone screen** (optional, for their own reference):
   - Their drafted players with team logos and positions
   - Searchable, filterable list of all available players
   - Can see who's already taken vs. still available
   - Read-only — they tell the admin their pick, admin enters it

### Phase 3: Season Tracking

1. After draft completes, participants can log in anytime to:
   - View standings with all teams ranked by total points
   - See "today's points" and "games behind" leader
   - View their own team roster with individual player stats
2. Nightly cron job updates scores:
   - Fetches completed games from NHL API
   - Extracts goals + assists per player per game
   - Upserts PlayerScore records for all active drafts
   - Recalculates team totals and standings

## Data Model

### Drafts

```sql
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('playoffs', 'regular_season')),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'inviting', 'in_progress', 'complete')),
  draft_date DATE,
  draft_time TEXT,
  location TEXT,
  entry_fee INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'CAD',
  payment_method TEXT,
  payment_info TEXT,
  notes TEXT,
  players_per_team INTEGER NOT NULL DEFAULT 10,
  scoring_format TEXT NOT NULL DEFAULT '1pt_per_goal_assist',
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  current_round INTEGER DEFAULT 1,
  current_pick INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Note: The admin is also a participant. When creating a draft, the admin gets their own `draft_participant` record with `draft_position` assigned. This is how the draft coach knows which team is "yours."

Draft positions are assigned by the admin at draft setup (matching the current app's "your draft position" selector). Positions can be randomized or manually assigned.

### Draft Invites

```sql
CREATE TABLE draft_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'rejected')),
  invited_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Draft Participants

```sql
CREATE TABLE draft_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_name TEXT NOT NULL,
  draft_position INTEGER,
  invite_id UUID REFERENCES draft_invites(id),
  has_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, user_id)
);
```

### Draft Picks

```sql
CREATE TABLE draft_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  manager_index INTEGER NOT NULL,
  participant_id UUID REFERENCES draft_participants(id) NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Players

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT NOT NULL,
  regular_season_goals INTEGER DEFAULT 0,
  regular_season_assists INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  points_per_game NUMERIC(4,2) DEFAULT 0,
  last_10_goals INTEGER,
  last_10_assists INTEGER,
  last_10_games INTEGER,
  last_20_goals INTEGER,
  last_20_assists INTEGER,
  last_20_games INTEGER,
  team_advancement_r1 NUMERIC(5,4),
  team_advancement_r2 NUMERIC(5,4),
  team_advancement_r3 NUMERIC(5,4),
  team_advancement_r4 NUMERIC(5,4),
  projected_playoff_games NUMERIC(5,2),
  projected_playoff_points NUMERIC(6,2),
  rank INTEGER,
  adp NUMERIC(5,2),
  injury_status TEXT DEFAULT 'healthy',
  injury_expected_return TEXT,
  injury_description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Player Scores

```sql
CREATE TABLE player_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT REFERENCES players(id) NOT NULL,
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  season_type TEXT NOT NULL,
  score_date DATE NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  UNIQUE(player_id, draft_id, score_date)
);
```

## Authentication

### Supabase Auth Configuration

- Enable email/password provider
- Enable Google OAuth provider
- Store role and team name in user metadata: `{ role: 'admin' | 'participant', teamName: string }`

### Row-Level Security Policies

- **drafts**: anyone can view drafts they participate in; only admin can update
- **draft_participants**: users can view their own participant record; admin can view all for their drafts
- **draft_picks**: anyone in the draft can view all picks; only admin can insert/update
- **draft_invites**: admin can view/manage invites for their drafts
- **player_scores**: anyone in the draft can view scores for their draft
- **players**: public read access

### Invite Flow

1. Admin enters email -> app creates draft_invite record and sends email via Supabase Auth invite (or custom email via Supabase Edge Function)
2. Invite link includes draft ID in redirect URL
3. New user signs up (Google or email/password) -> redirected to draft registration
4. User enters team name -> creates draft_participant record
5. draft_invite status updated to 'registered'

## UI Components

### Existing Components (Reuse)

- `DraftGrid` — Snake draft board with team logos, positions, injuries (TV view)
- `DraftCoach` — Strategy engine with recommendations (admin phone view)
- `BestAvailable` — Best available players list
- `FullPlayerList` — Complete player search/filter
- `TeamStackPanel` — Team stacking analysis
- `PositionTracker` — Position distribution
- `TeamCompositionVisualizer` — Visual team composition
- `TeamLogo` — NHL team logos
- `InjuryFlag` — Injury status indicators
- `PlayerTable` — Sortable player rankings table

### New Components

- `AdminDashboard` — Draft setup, participant management, invite sending
- `DraftSetupForm` — Event details, config, payment fields
- `ParticipantList` — Registered/pending participants with status
- `InviteForm` — Add emails individually or bulk paste
- `LiveDraftPage` — Wrapper for draft night with TV/phone view toggle
- `ParticipantTeamView` — Participant's drafted players + searchable available players
- `SeasonStandings` — Leaderboard with scores, today's points, games behind
- `TeamDetailPage` — Individual team roster with player stats breakdown
- `AuthLayout` — Login/signup pages with Google OAuth + email/password options

## Scoring System

### NHL API Integration

- **Base URL:** `https://api.nhl.com/api/v1`
- **Schedule endpoint:** `/schedule?date=YYYY-MM-DD` — get game IDs for a date
- **Boxscore endpoint:** `/game/{gameId}/boxscore` — get player stats (goals, assists)
- **No authentication required**, rate-limited but sufficient for nightly batch

### Cron Job (Vercel Cron)

- **Schedule:** `0 6 * * *` (daily at 6 AM UTC / 2 AM ET, after games finish)
- **Process:**
  1. Fetch completed games from previous day
  2. For each game, extract player stats (goals + assists)
  3. For each active draft, upsert player_scores records
  4. Recalculate team totals: `SUM(player_scores.points) WHERE player_id IN (team's drafted players)`
- **Regular season:** tracks all 82 games, Oct-Apr
- **Playoffs:** tracks only playoff games

### Scoring Formats

- `1pt_per_goal_assist`: 1 point per goal + 1 point per assist (current default)
- `2pt_goals_1pt_assists`: 2 points per goal + 1 point per assist

## Deployment

### Vercel Configuration

- Next.js app deployed to Vercel free tier
- Environment variables: Supabase URL, Supabase anon key, Supabase service role key
- Vercel Cron configured in `vercel.json`
- Custom domain (optional)

### Supabase Setup

- Create project on Supabase free tier
- Enable email/password + Google OAuth providers
- Run migrations for all tables
- Configure RLS policies
- Set up email templates for invitations

## Migration from Current App

- Existing draft logic (`draft-logic.ts`, `draft-coach.ts`) moves from localStorage to Supabase
- Player data currently in `public/players.json` migrates to Supabase `players` table, still populated by scraper
- The Python scraper (`scraper/`) will be updated to write to Supabase via REST API (using service role key) instead of generating a JSON file, or as an intermediate step it can output JSON that's imported via a script
- Draft state currently in localStorage moves to database
- Existing UI components are preserved and adapted for multi-user context
- Admin's draft coach view keeps the same tabbed interface
- TV draft board keeps the same styled grid with logos, positions, injuries
- Existing pages (home rankings, rosters, bracket) remain accessible and are adapted to pull data from Supabase instead of static JSON
