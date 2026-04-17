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
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading player data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05]">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#c8d9c3] mb-4">
            Hockey Fantasy Pool
          </h1>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#c8d9c3] mb-2">
            Player Rankings
          </h2>
          <p className="text-[#5a6b57]">
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
            className="inline-block px-6 py-3 bg-[#4a7c59] text-[#c8d9c3] rounded-lg font-semibold hover:bg-[#3d664a] transition-colors"
          >
            Start Draft →
          </Link>
        </div>
      </main>
    </div>
  );
}
