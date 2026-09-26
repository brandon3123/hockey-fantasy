/**
 * Season-aware elimination status.
 *
 * A player is "eliminated" only when their team can no longer play in the
 * season THE DRAFT IS ABOUT. For a playoffs-mode draft that means knocked out
 * of the live NHL bracket. For a regular-season draft it can never be true:
 * a bracket fetched in September still reflects the season that ended in
 * April, and applying it struck out essentially every player on the dashboard.
 */

export type DraftSeasonType = 'regular' | 'playoffs';

export function isEliminatedFor(
  team: string | null | undefined,
  seasonType: DraftSeasonType,
  activePlayoffTeams: Set<string>,
): boolean {
  if (seasonType !== 'playoffs') return false;
  // No live bracket data -> we cannot claim anyone is out.
  if (!activePlayoffTeams || activePlayoffTeams.size === 0) return false;
  // Unknown team (missing lookup) -> do not strike out.
  if (!team) return false;
  return !activePlayoffTeams.has(team);
}
