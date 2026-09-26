/**
 * Player-import helpers shared by scripts/import-players.ts and its test.
 *
 * The row id embeds name, team and position. That makes a traded player a
 * *different* row, so an upsert alone leaves the old team behind forever and
 * the draft board ends up showing the same person twice. Callers must prune
 * ids that are no longer in players.json.
 */

export interface PlayerIdentity {
  name: string;
  team: string;
  position: string;
}

/**
 * Row id for a player: "brady-tkachuk-fla-lw".
 *
 * Note that non-ASCII characters become separators ("Aatu Räty" ->
 * "aatu-r-ty-ari-c"). That looks like a bug but it is what the existing rows
 * use - changing it would hand every accented player a new id and duplicate
 * them on the board, so the format is deliberately frozen.
 */
export function playerId(player: PlayerIdentity): string {
  return `${player.name}-${player.team}-${player.position}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

/**
 * Ids present in the database but absent from players.json.
 *
 * These are the rows a prune should delete: traded players under their old
 * team, and players no longer on any roster.
 */
export function stalePlayerIds(databaseIds: string[], fileIds: Set<string>): string[] {
  return databaseIds.filter(id => !fileIds.has(id));
}

/**
 * Split a list into fixed-size chunks.
 *
 * Used for reading and deleting in batches: PostgREST caps a single response
 * at 1000 rows by default, so an unpaginated read silently misses rows past
 * that point and they never get pruned.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
