'use client';

import { Player } from '@/types/player';
import { getHotColdStatus, cn } from '@/lib/utils';

interface RecentFormIndicatorProps {
  player: Player;
}

export default function RecentFormIndicator({ player }: RecentFormIndicatorProps) {
  const status = getHotColdStatus(player);

  if (!player.last10Games) {
    return <span className="text-xs text-[#5a6b57]">-</span>;
  }

  const ppg = (player.last10Games.points / player.last10Games.games).toFixed(2);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium",
        status === 'hot' && "bg-[#050a05] border-[#4a7c59] text-[#6b9b7a]",
        status === 'cold' && "bg-[#050a05] border-[#2d3c28] text-[#5a6b57]",
        status === 'neutral' && "bg-[#050a05] border-[#141e12] text-[#5a6b57]"
      )}
      title={`Last 10 games: ${player.last10Games.points} points (${ppg} PPG)`}
    >
      {status === 'hot' && <span>↑</span>}
      {status === 'cold' && <span>↓</span>}
      <span>{ppg}</span>
    </div>
  );
}
