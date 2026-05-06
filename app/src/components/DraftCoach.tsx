'use client';

import { useState, useEffect } from 'react';
import { Player, DraftState } from '@/types/player';
import { DraftStrategy, DraftCoachAnalysis, DraftRecommendation } from '@/types/draft-coach';
import { STRATEGIES, generateRecommendations, analyzeYourTeam, analyzeOpponents } from '@/lib/draft-coach';
import { loadLines, loadRankings, getPlayerLine, getLinesByTeam } from '@/lib/moneypuck-parser';
import TeamLogo from './TeamLogo';
import InjuryFlag from './InjuryFlag';

interface DraftCoachProps {
  draftState: DraftState;
  availablePlayers: Player[];
  allPlayers: Player[];
  onDraftPlayer: (player: Player) => void;
  draftComplete?: boolean;
  participantNames?: Record<string, string>;
}

export default function DraftCoach({
  draftState,
  availablePlayers,
  allPlayers,
  onDraftPlayer,
  draftComplete = false,
  participantNames = {}
}: DraftCoachProps) {
  // Load strategy from localStorage on mount
  const [strategy, setStrategy] = useState<DraftStrategy>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('draftCoachStrategy');
      if (saved && STRATEGIES[saved]) {
        return STRATEGIES[saved];
      }
    }
    return STRATEGIES.balanced;
  });

  // Load position requirements preference
  const [positionRequirements, setPositionRequirements] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('draftCoachPositionRequirements');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  const [analysis, setAnalysis] = useState<DraftCoachAnalysis | null>(null);
  const [linesLoaded, setLinesLoaded] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);

  // Save strategy to localStorage when it changes
  const handleStrategyChange = (strategyId: string) => {
    const newStrategy = STRATEGIES[strategyId];
    setStrategy(newStrategy);
    localStorage.setItem('draftCoachStrategy', strategyId);
  };

  // Save position requirements preference
  const handlePositionRequirementsToggle = (enabled: boolean) => {
    setPositionRequirements(enabled);
    localStorage.setItem('draftCoachPositionRequirements', JSON.stringify(enabled));
  };

  useEffect(() => {
    // Initialize data
    const initializeData = async () => {
      const linesData = await loadLines();
      const rankingsData = await loadRankings();
      if (linesData) setLines(linesData);
      if (rankingsData) setRankings(rankingsData);
      setLinesLoaded(true);
    };
    initializeData();
  }, []);

  useEffect(() => {
    // Recalculate when dependencies change
    const recalculate = async () => {
      if (!lines.length) return;

      // Create adjusted strategies based on position requirements preference
      const adjustedStrategy = {
        ...strategy,
        weights: {
          ...strategy.weights,
          position: positionRequirements ? strategy.weights.position : 0
        }
      };

      const yourTeam = analyzeYourTeam(draftState, lines, availablePlayers, allPlayers);
      const opponents = analyzeOpponents(draftState, lines, availablePlayers, allPlayers, participantNames);

      const recommendations = generateRecommendations(availablePlayers, draftState, adjustedStrategy, lines, allPlayers, participantNames);

      setAnalysis({
        recommendations,
        yourTeam,
        opponents: opponents.reduce((acc, opp, idx) => ({
          ...acc,
          [`Team ${idx + 1}`]: opp
        }), {}),
        poolAnalysis: {
          position: {
            C: { remaining: availablePlayers.filter(p => p.position === 'C').length, avgQuality: 12 },
            LW: { remaining: availablePlayers.filter(p => p.position === 'LW').length, avgQuality: 10 },
            RW: { remaining: availablePlayers.filter(p => p.position === 'RW').length, avgQuality: 10 },
            D: { remaining: availablePlayers.filter(p => p.position === 'D').length, avgQuality: 8 }
          },
          teams: Object.fromEntries(
            Object.entries(yourTeam.teams).map(([team, count]) => [team, availablePlayers.filter(p => p.team === team).length])
          )
        }
      });
    };

    if (draftState && availablePlayers.length > 0 && linesLoaded) {
      recalculate();
    }
  }, [draftState, availablePlayers, strategy, linesLoaded, allPlayers, lines, positionRequirements]);

  if (!analysis) {
    return <div className="text-[#5a6b57]">Loading Draft Coach...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#c8d9c3]">Draft Coach</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <select
              value={strategy.id}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="bg-[#141e12] border border-[#4a7c59] text-[#c8d9c3] px-3 py-1 rounded text-sm"
            >
              <option value="team-stack">Team Stack</option>
              <option value="balanced">Balanced</option>
              <option value="stars-depth">Stars + Depth</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#5a6b57]">Position Balance:</label>
            <button
              onClick={() => handlePositionRequirementsToggle(!positionRequirements)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                positionRequirements ? 'bg-[#4a7c59]' : 'bg-[#141e12]'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                positionRequirements ? 'left-5 bg-[#c8d9c3]' : 'left-0.5 bg-[#5a6b57]'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Strategy Description */}
      <div className="text-xs text-[#5a6b57] bg-[#0a0f0a] p-3 rounded">
        {strategy.description}
      </div>

      {/* Your Team Summary */}
      <div className="bg-[#0a0f0a] p-4 rounded-lg">
        <h4 className="text-sm font-semibold mb-3 text-[#c8d9c3]">Your Team</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-[#5a6b57]">Composition</div>
            <div className="text-sm text-[#c8d9c3]">
              {Object.entries(analysis.yourTeam.composition).map(([pos, count]) => (
                <span key={pos} className="mr-2">{pos}: {count}</span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#5a6b57]">Stacks</div>
            <div className="text-sm text-[#c8d9c3]">
              {Object.entries(analysis.yourTeam.teams).map(([team, count]) => (
                <span key={team} className="mr-2">{team}: {count}</span>
              ))}
            </div>
          </div>
        </div>
        {analysis.yourTeam.needs.length > 0 && (
          <div className="mt-3 text-xs text-[#5a6b57]">
            Needs: {analysis.yourTeam.needs.join(', ')}
          </div>
        )}
      </div>

      {/* Top 3 Recommendations */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-[#c8d9c3]">Recommended Picks</h4>
          {analysis.recommendations.map((rec, index) => {
          const player = rec.player;

          const round2Chance = player.teamAdvancementOdds?.round2 ? player.teamAdvancementOdds.round2 * 100 : null;

          const lineInfo = lines.length > 0 ? getPlayerLine(player.name, lines) : null;

          return (
            <div
              key={rec.player.name}
              onClick={() => !draftComplete && onDraftPlayer(rec.player)}
              className={`p-4 rounded-lg border-2 transition-all ${
                index === 0
                  ? 'border-[#4a7c59] bg-[#0a0f0a] cursor-pointer'
                  : 'border-[#141e12] bg-[#050a05] hover:border-[#4a7c59] cursor-pointer'
              } ${draftComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-[#4a7c59] text-[#c8d9c3]' : 'bg-[#141e12] text-[#5a6b57]'
                  }`}>
                    #{index + 1}
                  </div>
                  <TeamLogo team={rec.player.team} className="w-6 h-6" />
                  <div>
                    <div className="font-semibold text-[#c8d9c3]">{rec.player.name}</div>
                    <div className="text-xs text-[#5a6b57]">
                      {rec.player.team} • {rec.player.position} • {rec.player.displayPoints.toFixed(1)} pts
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#5a6b57]">{rec.score.toFixed(1)}</span>
                  <div className={`text-xs px-2 py-1 rounded ${
                    rec.fit === 'excellent' ? 'bg-[#4a7c59] text-[#c8d9c3]' :
                    rec.fit === 'good' ? 'bg-[#1a2f1a] text-[#5a6b57]' :
                    'bg-[#141e12] text-[#5a6b57]'
                  }`}>
                    {rec.fit} fit
                  </div>
                </div>
              </div>
              <div className="text-sm text-[#c8d9c3] mb-2 font-medium">{rec.reasoning.primary}</div>
              {rec.reasoning.secondary.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {rec.reasoning.secondary.map((reason, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-[#141e12] border border-[#4a7c59] rounded text-[#5a6b57]"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {/* Team Advancement Odds Badge */}
                {round2Chance !== null && (
                  <div className={`text-xs px-2 py-1 rounded font-medium ${
                    round2Chance >= 60 ? 'bg-[#1a3d1a] text-[#6b9b7a] border border-[#4a7c59]' :
                    round2Chance >= 40 ? 'bg-[#3d3a1a] text-[#9b8f6b] border border-[#7c744a]' :
                    'bg-[#3d1a1a] text-[#9b6b6b] border border-[#7c4a4a]'
                  }`}>
                    {round2Chance.toFixed(0)}% R2
                  </div>
                )}
                {/* Line Combo Badge */}
                {lineInfo && (
                  <div className="text-xs px-2 py-1 rounded bg-[#0a0f0a] text-[#5a6b57] border border-[#141e12]">
                    {lineInfo.name}
                  </div>
                )}
                {/* Injury Badge */}
                {rec.player.injury && rec.player.injury.status !== 'healthy' && (
                  <div className="text-xs px-2 py-1 rounded bg-[#0a0f0a] text-[#5a6b57] border border-[#141e12]">
                    {rec.player.injury.status}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
