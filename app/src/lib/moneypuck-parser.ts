import { LineCombination, TeamQuality } from '@/types/draft-coach';

let linesCache: Map<string, LineCombination[]> = new Map();
let rankingsCache: TeamQuality[] | null = null;

export async function loadLines(seasonType: string = 'playoffs'): Promise<LineCombination[] | null> {
  if (linesCache.has(seasonType)) return linesCache.get(seasonType)!;

  try {
    const filename = seasonType === 'playoffs' ? '/lines_playoffs.json' : '/lines_regular.json';
    const response = await fetch(filename);
    if (!response.ok) throw new Error(`Failed to load ${filename}`);
    const rawLines = await response.json();

    const processed = rawLines.map((line: any) => ({
      ...line,
      players: line.name.split('-').map((n: string) => n.trim())
    }));
    linesCache.set(seasonType, processed);

    return processed;
  } catch (error) {
    console.error('Failed to load lines:', error);
    return null;
  }
}

export async function loadRankings(): Promise<TeamQuality[] | null> {
  if (rankingsCache) return rankingsCache;

  try {
    const response = await fetch('/rankings.json');
    if (!response.ok) throw new Error('Failed to load rankings.json');
    rankingsCache = await response.json();
    return rankingsCache;
  } catch (error) {
    console.error('Failed to load rankings:', error);
    return null; // Return null to distinguish error from empty data
  }
}

export function getLinesByTeam(team: string, lines: LineCombination[]): LineCombination[] {
  return lines.filter(l => l.team === team).sort((a, b) => b.icetime - a.icetime);
}

export function getPlayerLine(playerName: string, lines: LineCombination[]): LineCombination | null {
  // Try exact match first
  const exactMatch = lines.find(l => l.players.includes(playerName));
  if (exactMatch) return exactMatch;

  // Try last name match (lines have last names only, players have full names)
  const lastName = playerName.split(' ').pop()?.toLowerCase();
  if (!lastName) return null;

  return lines.find(l =>
    l.players.some(p => p.toLowerCase() === lastName)
  ) || null;
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
