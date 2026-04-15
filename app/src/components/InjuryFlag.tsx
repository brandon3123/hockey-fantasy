'use client';

import { Player } from '@/types/player';
import { cn, getInjuryClass, formatInjuryReturn } from '@/lib/utils';

interface InjuryFlagProps {
  player: Player;
}

export default function InjuryFlag({ player }: InjuryFlagProps) {
  if (player.injury.status === 'healthy') {
    return null;
  }

  const tooltip = `${player.injury.status}\nExpected back: ${formatInjuryReturn(player.injury.expectedReturn)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        getInjuryClass(player.injury.status)
      )}
      title={tooltip}
    >
      {player.injury.status === 'day-to-day' && '🟡'}
      {player.injury.status === 'week-to-week' && '🟠'}
      {player.injury.status === 'out indefinitely' && '🔴'}
    </span>
  );
}
