'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types/player';
import PlayerTable from '@/components/PlayerTable';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface PlayerRow {
  id: string;
  name: string;
  team: string;
  position: string;
  regular_season_goals: number;
  regular_season_assists: number;
  games_played: number;
  points_per_game: number;
  last_10_goals: number | null;
  last_10_assists: number | null;
  last_10_games: number | null;
  last_20_goals: number | null;
  last_20_assists: number | null;
  last_20_games: number | null;
  team_advancement_r1: number;
  team_advancement_r2: number;
  team_advancement_r3: number;
  team_advancement_r4: number;
  projected_playoff_games: number;
  projected_playoff_points: number;
  games_remaining: number;
  projected_points: number;
  rank: number;
  adp: number | null;
  injury_status: string;
  injury_expected_return: string | null;
  injury_description: string | null;
}

function mapRowToPlayer(row: PlayerRow): Player {
  return {
    name: row.name,
    team: row.team,
    position: row.position as Player['position'],
    regularSeasonGoals: row.regular_season_goals,
    regularSeasonAssists: row.regular_season_assists,
    gamesPlayed: row.games_played,
    pointsPerGame: row.points_per_game,
    last10Games: row.last_10_games != null
      ? { goals: row.last_10_goals!, assists: row.last_10_assists!, points: row.last_10_goals! + row.last_10_assists!, games: row.last_10_games }
      : undefined,
    last20Games: row.last_20_games != null
      ? { goals: row.last_20_goals!, assists: row.last_20_assists!, points: row.last_20_goals! + row.last_20_assists!, games: row.last_20_games }
      : undefined,
    teamAdvancementOdds: {
      round1: row.team_advancement_r1,
      round2: row.team_advancement_r2,
      round3: row.team_advancement_r3,
      round4: row.team_advancement_r4,
    },
    projectedPlayoffGames: row.projected_playoff_games,
    projectedPlayoffPoints: row.projected_playoff_points,
    gamesRemaining: row.games_remaining,
    projectedPoints: row.projected_points,
    displayPoints: row.regular_season_goals + row.regular_season_assists,
    displayGames: row.games_played,
    rank: row.rank,
    adp: row.adp ?? undefined,
    injury: {
      status: row.injury_status as Player['injury']['status'],
      expectedReturn: row.injury_expected_return,
      description: row.injury_description,
    },
  };
}

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [liveInjuries, setLiveInjuries] = useState<Map<string, { status: string; description: string | null }>>(new Map());

  useEffect(() => {
    const loadPlayers = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('projected_points', { ascending: false });

      if (error) {
        console.error('Failed to load players from Supabase:', error);
        try {
          const res = await fetch('/players.json');
          const fallbackData = await res.json();
          setPlayers(fallbackData);
        } catch (e) {
          console.error('Fallback also failed:', e);
        }
      } else if (data) {
        setPlayers(data.map(mapRowToPlayer));
      }
      setLoading(false);
    };

    loadPlayers();

    const saved = localStorage.getItem('watchlist');
    if (saved) {
      setWatchlist(new Set(JSON.parse(saved)));
    }

    async function fetchLiveData() {
      try {
        const res = await fetch('/api/live-injuries');
        if (res.ok) {
          const data = await res.json();
          const map = new Map<string, { status: string; description: string | null }>();
          for (const [name, info] of Object.entries(data)) {
            map.set(name, info as { status: string; description: string | null });
          }
          setLiveInjuries(map);
        }
      } catch {}
    }
    fetchLiveData();
  }, []);

  const handleToggleWatchlist = (playerName: string) => {
    const newWatchlist = new Set(watchlist);
    if (newWatchlist.has(playerName)) {
      newWatchlist.delete(playerName);
    } else {
      newWatchlist.add(playerName);
    }
    setWatchlist(newWatchlist);
    localStorage.setItem('watchlist', JSON.stringify([...newWatchlist]));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading player data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05]">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-sm text-[#5a6b57] hover:text-[#c8d9c3]">
            &larr; Dashboard
          </Link>
          <h2 className="text-2xl font-bold text-[#c8d9c3] mt-2 mb-2">
            Player Rankings
          </h2>
          <p className="text-[#5a6b57]">
            Players ranked by projected points. Sort, filter, and build your watchlist.
          </p>
        </div>

        <PlayerTable
          players={players.map(p => {
            const live = liveInjuries.get(p.name.toLowerCase());
            if (live) {
              return { ...p, injury: { ...p.injury, status: live.status as Player['injury']['status'], description: live.description ?? p.injury.description } };
            }
            return p;
          })}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />

        <div className="mt-8 text-center">
          <Link
            href="/draft"
            className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Start Draft &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
