'use client';

import { Player } from '@/types/player';
import { getHotColdStatus, getHotColdClass, cn } from '@/lib/utils';

interface RecentFormIndicatorProps {
  player: Player;
}

export default function RecentFormIndicator({ player }: RecentFormIndicatorProps) {
  const status = getHotColdStatus(player);

  if (!status || !player.last10Games) {
    return <span className="text-gray-400">-</span>;
  }

  const ppg = (player.last10Games.points / player.last10Games.games).toFixed(2);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
        getHotColdClass(status)
      )}
      title={`Last 10 games: ${player.last10Games.points} points (${ppg} PPG)`}
    >
      {status === 'hot' && '🔥'}
      {status === 'cold' && '❄️'}
      <span>{ppg}</span>
    </div>
  );
}
