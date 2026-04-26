-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drafts table
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Draft invites
CREATE TABLE draft_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'rejected')),
  invited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft participants
CREATE TABLE draft_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_name TEXT NOT NULL,
  draft_position INTEGER,
  invite_id UUID REFERENCES draft_invites(id),
  has_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, user_id)
);

-- Draft picks
CREATE TABLE draft_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  manager_index INTEGER NOT NULL,
  participant_id UUID REFERENCES draft_participants(id) NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
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

-- Player scores (updated nightly by cron)
CREATE TABLE player_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id TEXT REFERENCES players(id) NOT NULL,
  draft_id UUID REFERENCES drafts(id) ON DELETE CASCADE NOT NULL,
  season_type TEXT NOT NULL,
  score_date DATE NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  UNIQUE(player_id, draft_id, score_date)
);

-- Row-Level Security Policies

-- Players: public read
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are publicly readable" ON players FOR SELECT USING (true);

-- Drafts: participants can view, admin can manage
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view drafts" ON drafts FOR SELECT USING (true);
CREATE POLICY "Admin can create drafts" ON drafts FOR INSERT WITH CHECK (auth.uid() = admin_user_id);
CREATE POLICY "Admin can update their drafts" ON drafts FOR UPDATE USING (auth.uid() = admin_user_id);

-- Draft invites: admin can manage for their drafts
ALTER TABLE draft_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view invites" ON draft_invites FOR SELECT USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can create invites" ON draft_invites FOR INSERT WITH CHECK (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can update invites" ON draft_invites FOR UPDATE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

-- Draft participants: users can view own, admin can view all for their drafts
ALTER TABLE draft_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view participants of their drafts" ON draft_participants FOR SELECT USING (
  user_id = auth.uid() OR
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Users can register as participants" ON draft_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can update participants" ON draft_participants FOR UPDATE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

-- Draft picks: anyone in draft can view, admin can insert/update
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view picks" ON draft_picks FOR SELECT USING (
  participant_id IN (SELECT id FROM draft_participants WHERE user_id = auth.uid()) OR
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can insert picks" ON draft_picks FOR INSERT WITH CHECK (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can update picks" ON draft_picks FOR UPDATE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Admin can delete picks" ON draft_picks FOR DELETE USING (
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);

-- Player scores: anyone in draft can view
ALTER TABLE player_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view scores" ON player_scores FOR SELECT USING (
  draft_id IN (
    SELECT dp.draft_id FROM draft_participants dp WHERE dp.user_id = auth.uid()
  ) OR
  draft_id IN (SELECT id FROM drafts WHERE admin_user_id = auth.uid())
);
CREATE POLICY "Service role can insert scores" ON player_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update scores" ON player_scores FOR UPDATE USING (true);
