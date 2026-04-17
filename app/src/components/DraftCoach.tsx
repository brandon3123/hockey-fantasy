'use client';

import { useState, useEffect } from 'react';
import { Player, DraftState } from '@/types/player';
import { DraftStrategy, DraftCoachAnalysis, DraftRecommendation } from '@/types/draft-coach';
import { STRATEGIES, generateRecommendations } from '@/lib/draft-coach';
import { loadLines, loadRankings } from '@/lib/moneypuck-parser';
import TeamLogo from './TeamLogo';

interface DraftCoachProps {
  draftState: DraftState;
  availablePlayers: Player[];
  onDraftPlayer: (player: Player) => void;
  draftComplete?: boolean;
}

export default function DraftCoach({
  draftState,
  availablePlayers,
  onDraftPlayer,
  draftComplete = false
}: DraftCoachProps) {
  const [strategy, setStrategy] = useState<DraftStrategy>(STRATEGIES.balanced);
  const [analysis, setAnalysis] = useState<DraftCoachAnalysis | null>(null);

  useEffect(() => {
    // Initialize data
    const initializeData = async () => {
      await loadLines();
      await loadRankings();
    };
    initializeData();
  }, []);

  useEffect(() => {
    // Recalculate when draft state changes
    const recalculate = async () => {
      const lines = await loadLines();
      if (!lines) return; // Skip if lines not loaded

      const recommendations = generateRecommendations(availablePlayers, draftState, strategy, lines);

      setAnalysis({
        recommendations,
        yourTeam: {
          composition: { C: 2, LW: 1, RW: 1, D: 2 }, // Placeholder
          teams: { EDM: 2, TOR: 1 },
          lines: [],
          needs: ['Need 2D', 'Need LW']
        },
        opponents: {},
        poolAnalysis: {
          position: { C: { remaining: 45, avgQuality: 12.5 } },
          teams: { EDM: 15 }
        }
      });
    };

    if (draftState && availablePlayers.length > 0) {
      recalculate();
    }
  }, [draftState, availablePlayers, strategy]);

  if (!analysis) {
    return <div className="text-[#5a6b57]">Loading Draft Coach...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#c8d9c3]">Draft Coach</h3>
        <select
          value={strategy.id}
          onChange={(e) => setStrategy(STRATEGIES[e.target.value])}
          className="bg-[#141e12] border border-[#4a7c59] text-[#c8d9c3] px-3 py-1 rounded text-sm"
        >
          <option value="team-stack">Team Stack</option>
          <option value="balanced">Balanced</option>
          <option value="stars-depth">Stars + Depth</option>
        </select>
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
        {analysis.recommendations.map((rec, index) => (
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
                <div>
                  <div className="font-semibold text-[#c8d9c3]">{rec.player.name}</div>
                  <div className="text-xs text-[#5a6b57]">
                    {rec.player.team} • {rec.player.position} • {rec.player.projectedPlayoffPoints.toFixed(1)} pts
                  </div>
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded ${
                rec.fit === 'excellent' ? 'bg-[#4a7c59] text-[#c8d9c3]' :
                rec.fit === 'good' ? 'bg-[#1a2f1a] text-[#5a6b57]' :
                'bg-[#141e12] text-[#5a6b57]'
              }`}>
                {rec.fit} fit
              </div>
            </div>
            <div className="text-sm text-[#c8d9c3] mb-1">{rec.reasoning.primary}</div>
            {rec.reasoning.secondary.length > 0 && (
              <div className="text-xs text-[#5a6b57]">
                {rec.reasoning.secondary.join(' • ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
