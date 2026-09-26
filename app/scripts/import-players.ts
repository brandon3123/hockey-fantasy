import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { chunk, playerId, stalePlayerIds } from '../src/lib/player-import';

// Next.js loads .env.local for the app automatically, but a standalone script
// has to do it itself or it cannot find the Supabase credentials.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(join(__dirname, '..', '.env.local'));
  } catch {
    // No .env.local (or unreadable) - the check below reports it.
  }
}

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
  gamesRemaining: number;
  projectedPoints: number;
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

  const rows = players.map((p) => {
    const id = playerId(p)
    return {
      id,
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
    team_advancement_r1: p.teamAdvancementOdds?.round1 ?? 0,
    team_advancement_r2: p.teamAdvancementOdds?.round2 ?? 0,
    team_advancement_r3: p.teamAdvancementOdds?.round3 ?? 0,
    team_advancement_r4: p.teamAdvancementOdds?.round4 ?? 0,
    projected_playoff_games: p.projectedPlayoffGames,
    projected_playoff_points: p.projectedPlayoffPoints,
    games_remaining: p.gamesRemaining,
    projected_points: p.projectedPoints,
    rank: p.rank,
    adp: p.adp ?? null,
    injury_status: p.injury.status,
    injury_expected_return: p.injury.expectedReturn,
    injury_description: p.injury.description,
    updated_at: new Date().toISOString(),
    };
  });

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

  console.log('Upsert complete. Pruning rows that are no longer in players.json...');
  // Paginated: PostgREST returns at most 1000 rows per response, and an
  // unpaginated read would leave stale rows past that cap un-pruned.
  const existingIds: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error: readError } = await supabase
      .from('players')
      .select('id')
      .range(from, from + pageSize - 1);
    if (readError) {
      console.error('Error reading existing players:', readError);
      process.exit(1);
    }
    existingIds.push(...page.map(r => r.id));
    if (page.length < pageSize) break;
  }

  const stale = stalePlayerIds(existingIds, new Set(rows.map(r => r.id)));
  if (stale.length === 0) {
    console.log('Nothing to prune.');
  } else {
    // Chunked: a single .in() with thousands of ids can exceed a header limit.
    for (const chunkIds of chunk(stale, 100)) {
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .in('id', chunkIds);
      if (deleteError) {
        console.error(`Error pruning batch starting ${chunkIds[0]}:`, deleteError);
        process.exit(1);
      }
    }
    console.log(`Pruned ${stale.length} stale rows (traded players under their old team, and players off the roster).`);
    console.log(`  e.g. ${stale.slice(0, 5).join(', ')}`);
  }

  // Post-condition: the table should now hold exactly the file's players.
  const { count: finalCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
  if (finalCount !== players.length) {
    console.warn(`WARNING: players table holds ${finalCount} rows but players.json has ${players.length}.`);
    console.warn('  Rows past PostgREST\'s 1000-row cap may still need pruning.');
  } else {
    console.log(`Verified: players table holds exactly ${finalCount} rows, matching players.json.`);
  }

  console.log('Import complete!');
}

importPlayers();
