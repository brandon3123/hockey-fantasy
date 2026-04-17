'use client';

import { useState } from 'react';
import { Player } from '@/types/player';

interface InjuryFlagProps {
  player: Player;
}

export default function InjuryFlag({ player }: InjuryFlagProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (player.injury.status === 'healthy') {
    return null;
  }

  const label =
    player.injury.status === 'day-to-day' ? 'DTD' :
    player.injury.status === 'week-to-week' ? 'WTW' :
    'OUT';

  const color =
    player.injury.status === 'day-to-day' ? 'text-yellow-500 border-yellow-500' :
    player.injury.status === 'week-to-week' ? 'text-orange-500 border-orange-500' :
    'text-red-500 border-red-500';

  // Build tooltip content
  const tooltipParts = [];
  if (player.injury.expectedReturn) {
    tooltipParts.push(`Expected: ${player.injury.expectedReturn}`);
  }
  if (player.injury.description) {
    tooltipParts.push(player.injury.description);
  }

  const hasDetails = tooltipParts.length > 0;

  return (
    <div
      className="relative flex items-center gap-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-semibold ${color}`}
      >
        {label}
      </span>
      {hasDetails && (
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#4a7c59] text-[#c8d9c3] text-[10px] font-semibold cursor-help hover:bg-[#6b9b7a] transition-colors"
        >
          i
        </span>
      )}
      {showTooltip && hasDetails && (
        <div className="absolute z-50 bottom-full mb-2 left-0 w-64 p-3 bg-[#4a7c59] text-[#c8d9c3] text-xs rounded-lg shadow-xl border border-[#6b9b7a]">
          <div className="flex flex-col gap-1">
            {tooltipParts.map((part, idx) => (
              <div key={idx} className="leading-snug">
                {part}
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-2 -mt-1 w-2 h-2 bg-[#4a7c59] border-r border-b border-[#6b9b7a] transform rotate-45"></div>
        </div>
      )}
    </div>
  );
}
