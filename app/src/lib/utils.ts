import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Player } from "@/types/player";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isInjured(player: Player): boolean {
  return player.injury.status !== 'healthy';
}

export function getInjuryClass(status: Player['injury']['status']): string {
  switch (status) {
    case 'day-to-day':
      return 'text-yellow-600';
    case 'week-to-week':
      return 'text-orange-600';
    case 'out indefinitely':
      return 'text-red-600';
    case 'out for playoffs':
      return 'text-gray-400 line-through';
    default:
      return '';
  }
}

export function getHotColdStatus(player: Player): 'hot' | 'cold' | null {
  if (!player.last10Games) return null;

  const last10Ppg = player.last10Games.points / player.last10Games.games;
  const seasonPpg = player.pointsPerGame;

  if (last10Ppg >= seasonPpg * 1.2) return 'hot';
  if (last10Ppg <= seasonPpg * 0.8) return 'cold';
  return null;
}

export function getHotColdClass(status: 'hot' | 'cold' | null): string {
  switch (status) {
    case 'hot': return 'bg-green-100 text-green-800';
    case 'cold': return 'bg-red-100 text-red-800';
    default: return '';
  }
}

export function getAdpValue(player: Player, currentPick: number): number {
  if (!player.adp) return 0;
  return player.adp - currentPick;
}

export function isAdpSteal(player: Player, currentPick: number): boolean {
  const value = getAdpValue(player, currentPick);
  return value > 10;
}

export function isAdpReach(player: Player, currentPick: number): boolean {
  const value = getAdpValue(player, currentPick);
  return value < -5;
}

export function getAvailableTeammates(
  player: Player,
  availablePlayers: Player[]
): Player[] {
  return availablePlayers.filter(
    p => p.team === player.team && p.name !== player.name
  ).sort((a, b) => b.projectedPlayoffPoints - a.projectedPlayoffPoints);
}

export function formatInjuryReturn(expectedReturn: string | null): string {
  if (!expectedReturn) return 'TBD';

  try {
    const date = new Date(expectedReturn);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Should return soon';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays} days`;
    if (diffDays <= 14) return '1-2 weeks';
    return expectedReturn;
  } catch {
    return expectedReturn;
  }
}
