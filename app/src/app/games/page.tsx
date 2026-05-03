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
    fetch('/api/games')
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
          <div className="space-y-4">
            {data.games.map((game, i) => (
              <div
                key={`${game.away}-${game.home}-${i}`}
                className="bg-[#0a0f0a] border border-[#1a2f1a] rounded-lg p-4 md:p-6"
              >
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <TeamLogo team={game.away} className="w-12 h-12" />
                    <span className="text-sm font-bold text-[#c8d9c3]">{game.away}</span>
                  </div>
                  <span className="text-sm text-[#5a6b57]">@</span>
                  <div className="flex flex-col items-center gap-1">
                    <TeamLogo team={game.home} className="w-12 h-12" />
                    <span className="text-sm font-bold text-[#c8d9c3]">{game.home}</span>
                  </div>
                </div>
                <div className="text-center text-xs text-[#5a6b57] mt-2">{game.time}</div>

                <div className="border-t border-[#1a2f1a] mt-3 pt-3">
                  {game.yourPlayers.length > 0 ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[#5a6b57] mb-2">
                        Your Players
                      </div>
                      <div className="space-y-1.5">
                        {game.yourPlayers.map((player, j) => (
                          <div
                            key={`${player.playerName}-${j}`}
                            className="flex items-center gap-2"
                          >
                            <TeamLogo
                              team={game.away}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-[#c8d9c3]">
                              {player.playerName}
                            </span>
                            <span className="text-xs text-[#5a6b57]">
                              {player.position}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-sm text-[#5a6b57]">
                      No rostered players in this game
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
