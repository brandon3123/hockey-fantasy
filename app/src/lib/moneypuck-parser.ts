import { LineCombination, TeamQuality } from '@/types/draft-coach';

let linesCache: LineCombination[] | null = null;
let rankingsCache: TeamQuality[] | null = null;

export async function loadLines(): Promise<LineCombination[]> {
  if (linesCache) return linesCache;

  try {
    const response = await fetch('/lines.json');
    if (!response.ok) throw new Error('Failed to load lines.json');
    const rawLines = await response.json();

    // Process lines: extract player names from "Donato-Bedard-Mikheyev" format
    linesCache = rawLines.map((line: any) => ({
      ...line,
      players: line.name.split('-').map((n: string) => n.trim())
    }));

    return linesCache!;
  } catch (error) {
    console.error('Failed to load lines:', error);
    return [];
  }
}

export async function loadRankings(): Promise<TeamQuality[]> {
  if (rankingsCache) return rankingsCache;

  try {
    const response = await fetch('/rankings.json');
    if (!response.ok) throw new Error('Failed to load rankings.json');
    rankingsCache = await response.json();
    return rankingsCache!;
  } catch (error) {
    console.error('Failed to load rankings:', error);
    return [];
  }
}

export function getLinesByTeam(team: string, lines: LineCombination[]): LineCombination[] {
  return lines.filter(l => l.team === team).sort((a, b) => b.icetime - a.icetime);
}

export function getPlayerLine(playerName: string, lines: LineCombination[]): LineCombination | null {
  return lines.find(l => l.players.includes(playerName)) || null;
}

export function getTeammates(playerName: string, lines: LineCombination[]): string[] {
  const line = getPlayerLine(playerName, lines);
  if (!line) return [];

  return line.players.filter(p => p !== playerName);
}

export function getTopLine(team: string, lines: LineCombination[]): LineCombination | null {
  const teamLines = getLinesByTeam(team, lines);
  return teamLines[0] || null; // Most icetime = top line
}
