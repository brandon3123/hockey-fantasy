'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types/player';
import PlayerTable from '@/components/PlayerTable';
import Link from 'next/link';

export default function HomePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load players from static JSON
    fetch('/players.json')
      .then(res => res.json())
      .then(data => {
        setPlayers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load players:', err);
        setLoading(false);
      });

    // Load watchlist from localStorage
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      setWatchlist(new Set(JSON.parse(saved)));
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading player data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            🏒 Hockey Playoff Draft Helper
          </h1>
          <nav className="flex gap-4">
            <Link href="/" className="text-blue-600 font-medium">
              Rankings
            </Link>
            <Link href="/draft" className="text-gray-600 hover:text-blue-600">
              Draft Board
            </Link>
            <Link href="/rosters" className="text-gray-600 hover:text-blue-600">
              Rosters
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Pre-Draft Rankings
          </h2>
          <p className="text-gray-600">
            Players ranked by projected playoff points. Sort, filter, and build your watchlist.
          </p>
        </div>

        <PlayerTable
          players={players}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />

        <div className="mt-8 text-center">
          <Link
            href="/draft"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Draft →
          </Link>
        </div>
      </main>
    </div>
  );
}
