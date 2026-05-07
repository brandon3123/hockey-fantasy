'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TeamLogo from '@/components/TeamLogo';

interface Game {
  away: string;
  home: string;
  awayLogo: string;
  homeLogo: string;
  time: string;
  yourPlayers: Array<{ playerName: string; position: string }>;
}

interface GamesData {
  games: Game[];
  totalYourPlayers: number;
}

export default function GamesPage() {
  const [data, setData] = useState<GamesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/games?tz=${encodeURIComponent(tz)}`)
      .then(res => res.json())
      .then((d: GamesData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050a05] flex items-center justify-center">
        <div className="text-xl text-[#5a6b57]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a05]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-[#5a6b57] mb-2">
            Tonight&apos;s Games
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#c8d9c3]">{today}</h1>
          {data && data.totalYourPlayers > 0 && (
            <p className="text-sm text-[#5a6b57] mt-2">
              {data.games.length} {data.games.length === 1 ? 'game' : 'games'} &middot;{' '}
              {data.totalYourPlayers} of your {data.totalYourPlayers === 1 ? 'player' : 'players'} in action
            </p>
          )}
        </div>

        {!data || data.games.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-xl text-[#5a6b57]">No games scheduled tonight</div>
          </div>
        ) : (
          <div className={`grid gap-3 ${
            data.games.length <= 2 ? 'grid-cols-2 max-w-md mx-auto' :
            data.games.length <= 4 ? 'grid-cols-2' :
            data.games.length <= 8 ? 'grid-cols-2 sm:grid-cols-3' :
            'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}>
            {data.games.map((game, i) => {
              const hasPlayers = game.yourPlayers.length > 0;
              return (
                <div
                  key={`${game.away}-${game.home}-${i}`}
                  className={`bg-[#0a0f0a] border rounded-lg p-4 text-center ${
                    hasPlayers ? 'border-[#1a2f1a]' : 'border-[#141e12] opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <TeamLogo team={game.away} className="w-9 h-9" />
                      <span className="text-xs font-bold text-[#c8d9c3]">{game.away}</span>
                    </div>
                    <span className="text-xs text-[#5a6b57]">@</span>
                    <div className="flex flex-col items-center gap-1">
                      <TeamLogo team={game.home} className="w-9 h-9" />
                      <span className="text-xs font-bold text-[#c8d9c3]">{game.home}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#5a6b57] mt-1.5">{game.time}</div>
                  {hasPlayers && (
                    <div className="flex flex-wrap gap-1 justify-center mt-2.5">
                      {game.yourPlayers.map((player, j) => (
                        <span
                          key={`${player.playerName}-${j}`}
                          className="text-[10px] px-2 py-0.5 bg-[#1a2f1a] text-[#6b9b7a] rounded"
                        >
                          {player.playerName.split(' ').pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
