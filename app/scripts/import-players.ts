import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PlayerJSON {
  name: string;
  team: string;
  position: string;
  regularSeasonGoals: number;
  regularSeasonAssists: number;
  gamesPlayed: number;
  pointsPerGame: number;
  last10Games?: { goals: number; assists: number; games: number };
  last20Games?: { goals: number; assists: number; games: number };
  teamAdvancementOdds: { round1: number; round2: number; round3: number; round4: number };
  projectedPlayoffGames: number;
  projectedPlayoffPoints: number;
  rank: number;
  adp?: number;
  injury: {
    status: string;
    expectedReturn: string | null;
    description: string | null;
  };
}

async function importPlayers() {
  const filePath = join(__dirname, '..', 'public', 'players.json');
  const raw = readFileSync(filePath, 'utf-8');
  const players: PlayerJSON[] = JSON.parse(raw);

  console.log(`Found ${players.length} players to import`);

  const rows = players.map((p) => ({
    id: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: p.name,
    team: p.team,
    position: p.position,
    regular_season_goals: p.regularSeasonGoals,
    regular_season_assists: p.regularSeasonAssists,
    games_played: p.gamesPlayed,
    points_per_game: p.pointsPerGame,
    last_10_goals: p.last10Games?.goals ?? null,
    last_10_assists: p.last10Games?.assists ?? null,
    last_10_games: p.last10Games?.games ?? null,
    last_20_goals: p.last20Games?.goals ?? null,
    last_20_assists: p.last20Games?.assists ?? null,
    last_20_games: p.last20Games?.games ?? null,
    team_advancement_r1: p.teamAdvancementOdds.round1,
    team_advancement_r2: p.teamAdvancementOdds.round2,
    team_advancement_r3: p.teamAdvancementOdds.round3,
    team_advancement_r4: p.teamAdvancementOdds.round4,
    projected_playoff_games: p.projectedPlayoffGames,
    projected_playoff_points: p.projectedPlayoffPoints,
    rank: p.rank,
    adp: p.adp ?? null,
    injury_status: p.injury.status,
    injury_expected_return: p.injury.expectedReturn,
    injury_description: p.injury.description,
    updated_at: new Date().toISOString(),
  }));

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('players').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Error importing batch ${i}:`, error);
      process.exit(1);
    }
    console.log(`Imported ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
  }

  console.log('Import complete!');
}

importPlayers();
