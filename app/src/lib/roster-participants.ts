/**
 * Roster-participant helpers for host-only drafts: participants are typed-in
 * team names with no accounts (user_id NULL in draft_participants).
 */

export interface ParticipantRow {
  draft_id: string;
  user_id: string | null;
  team_name: string;
  draft_position: number;
}

export type NamesResult = { ok: true; names: string[] } | { ok: false; error: string };

/**
 * First case-insensitive duplicate in a final seat list, or null.
 * Covers every source of a seat name — typed rows, the admin's own seat,
 * start-modal renames — since they all share one namespace per draft.
 */
export function findDuplicateName(names: string[]): string | null {
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}

const MIN_NAMES = 2;
const MAX_NAMES = 20;

/**
 * Trim a typed name list, drop empties, reject duplicates case-insensitively.
 * Order is preserved: typed order becomes draft order.
 */
export function normalizeRosterNames(names: string[]): NamesResult {
  const cleaned = names.map(n => n.trim()).filter(n => n.length > 0);
  if (cleaned.length < MIN_NAMES) return { ok: false, error: 'At least 2 team names required' };
  if (cleaned.length > MAX_NAMES) return { ok: false, error: 'At most 20 team names allowed' };

  const seen = new Set<string>();
  for (const name of cleaned) {
    const key = name.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `Duplicate team name: ${name}` };
    seen.add(key);
  }
  return { ok: true, names: cleaned };
}

/**
 * Seat rows for a roster draft: typed names first (positions 1..n, no user),
 * the admin's own seat last when opted in (position n+1).
 */
export function buildParticipantRows(
  names: string[],
  opts: { draftId: string; adminUserId: string; seatMe: boolean; myName?: string },
): ParticipantRow[] {
  const rows: ParticipantRow[] = names.map((team_name, i) => ({
    draft_id: opts.draftId,
    user_id: null,
    team_name,
    draft_position: i + 1,
  }));

  if (opts.seatMe) {
    rows.push({
      draft_id: opts.draftId,
      user_id: opts.adminUserId,
      team_name: opts.myName?.trim() || 'Commissioner',
      draft_position: names.length + 1,
    });
  }
  return rows;
}
