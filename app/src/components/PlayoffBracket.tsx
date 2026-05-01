'use client';

import { useState, useEffect } from 'react';
import TeamLogo from './TeamLogo';

interface PlayoffBracketProps {
  year?: number;
}

interface Matchup {
  team1: string;
  team2: string;
  winner?: string;
}

export default function PlayoffBracket({ year = 2026 }: PlayoffBracketProps) {
  const [selectedRound, setSelectedRound] = useState<'first' | 'second' | 'conference' | 'final'>('first');
  const [playoffData, setPlayoffData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlayoffBracket = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/playoff-bracket?year=${year}`);
        if (!response.ok) throw new Error(`Failed to fetch playoff bracket: ${response.status}`);
        const data = await response.json();
        setPlayoffData(data);
      } catch (err) {
        console.error('Failed to fetch playoff bracket:', err);
        setError('Failed to load playoff bracket. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayoffBracket();
  }, [year]);

  if (loading) {
    return (
      <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] p-6">
        <div className="text-center text-[#5a6b57]">Loading playoff bracket...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] p-6">
        <div className="text-center text-[#5a6b57]">{error}</div>
      </div>
    );
  }

  const getMatchupsByRound = () => {
    if (!playoffData || !playoffData.series) return { eastern: [], western: [], finals: [] };

    const eastern: Matchup[] = [];
    const western: Matchup[] = [];
    const finals: Matchup[] = [];

    const roundMap: { [key: string]: number } = {
      'first': 1,
      'second': 2,
      'conference': 3,
      'final': 4
    };

    const currentRound = roundMap[selectedRound];

    playoffData.series.forEach((series: any) => {
      if (series.playoffRound !== currentRound) return;
      if (!series.topSeedTeam || !series.bottomSeedTeam) return;

      const matchup: Matchup = {
        team1: series.topSeedTeam.abbrev || 'TBD',
        team2: series.bottomSeedTeam.abbrev || 'TBD'
      };

      if (series.playoffRound === 4) {
        finals.push(matchup);
      } else {
        const seriesLetter = series.seriesLetter;
        if (['A', 'B', 'C', 'D', 'I', 'J', 'M'].includes(seriesLetter)) {
          eastern.push(matchup);
        } else if (['E', 'F', 'G', 'H', 'K', 'L', 'N'].includes(seriesLetter)) {
          western.push(matchup);
        }
      }
    });

    return { eastern, western, finals };
  };

  const { eastern: currentEastern, western: currentWestern, finals: currentFinals } = getMatchupsByRound();

  const rounds = [
    { key: 'first', label: '1st Round' },
    { key: 'second', label: '2nd Round' },
    { key: 'conference', label: 'Conf. Finals' },
    { key: 'final', label: 'Stanley Cup' },
  ] as const;

  return (
    <div className="bg-[#0a0f0a] rounded-lg border border-[#141e12] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-[#c8d9c3]">NHL Playoff Bracket {year}</h2>
        <div className="flex gap-2 flex-wrap">
          {rounds.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedRound(key)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedRound === key
                  ? 'bg-[#4a7c59] text-[#c8d9c3]'
                  : 'bg-[#050a05] text-[#5a6b57] hover:bg-[#141e12]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conference Headers */}
      {selectedRound !== 'final' && (
        <div className="grid grid-cols-2 gap-8 mb-4">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-[#5a6b57] uppercase tracking-widest">Eastern Conference</h3>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-semibold text-[#5a6b57] uppercase tracking-widest">Western Conference</h3>
          </div>
        </div>
      )}

      {/* Matchups */}
      <div className="space-y-3">
        {selectedRound !== 'final' && currentEastern.length > 0 && currentWestern.length > 0 && (
          <div className="grid grid-cols-2 gap-8">
            {[{ matchups: currentEastern, key: 'east' }, { matchups: currentWestern, key: 'west' }].map(({ matchups, key }) => (
              <div key={key} className="space-y-3">
                {matchups.map((matchup, i) => (
                  <div key={`${key}-${i}`} className="bg-[#050a05] border border-[#141e12] rounded-lg p-3 hover:border-[#4a7c59] transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-[#6b9b7a] w-5 shrink-0">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <TeamLogo team={matchup.team1} className="w-6 h-6" />
                          <span className="font-semibold text-[#c8d9c3]">{matchup.team1}</span>
                        </div>
                        <div className="text-xs text-[#5a6b57] pl-8">vs</div>
                        <div className="flex items-center gap-2 mt-1">
                          <TeamLogo team={matchup.team2} className="w-6 h-6" />
                          <span className="font-semibold text-[#c8d9c3]">{matchup.team2}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {selectedRound !== 'final' && (currentEastern.length === 0 || currentWestern.length === 0) && (
          <div className="text-center py-8 text-[#5a6b57]">
            <p>Playoff data for this round will be available once the series begin.</p>
            <p className="text-sm mt-2">Data updates automatically from the official NHL API.</p>
          </div>
        )}

        {selectedRound === 'final' && (
          <div className="max-w-md mx-auto">
            <div className="bg-[#050a05] border-2 border-[#4a7c59] rounded-xl p-8 text-center">
              <h3 className="text-xl font-bold text-[#c8d9c3] mb-6">Stanley Cup Final</h3>
              {currentFinals.length > 0 ? (
                <div className="space-y-4">
                  {currentFinals.map((matchup, i) => (
                    <div key={i} className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={matchup.team1} className="w-8 h-8" />
                        <span className="font-bold text-xl text-[#c8d9c3]">{matchup.team1}</span>
                      </div>
                      <span className="text-[#5a6b57]">vs</span>
                      <div className="flex items-center gap-2">
                        <TeamLogo team={matchup.team2} className="w-8 h-8" />
                        <span className="font-bold text-xl text-[#c8d9c3]">{matchup.team2}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-[#5a6b57] mt-4">First to 4 wins the Stanley Cup</div>
                </div>
              ) : (
                <div className="text-sm text-[#5a6b57]">
                  Final matchup will be determined once conference finals complete
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 bg-[#050a05] border border-[#141e12] rounded-lg">
        <h4 className="font-semibold text-[#c8d9c3] mb-2">Fantasy Tips</h4>
        <ul className="text-sm text-[#5a6b57] space-y-1">
          <li>• Target players from teams with favorable matchups</li>
          <li>• Consider playoff experience — veteran teams often perform better</li>
          <li>• Watch for series that go deep — more games means more fantasy points</li>
          <li>• Stack players from teams you think will advance to later rounds</li>
        </ul>
      </div>
    </div>
  );
}
