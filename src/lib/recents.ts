import type { RecentDestination } from './types';
import { persist } from './storage';

const KEY = 'psg.recents';
const MAX = 5;

// Placeholder "recents" earlier builds showed to every new visitor. pushRecent
// prepended to whatever loadRecents returned, so the first real search saved
// them into localStorage beside it. They never carry coords (real entries have
// since 2026-05-24), so an exact name + hint match without coords is one of
// these and gets dropped on load.
const LEGACY_SEED = new Set([
  'vivocity|harbourfront',
  '313 somerset|orchard',
  'jewel changi|airport',
  'tiong bahru plaza|bukit merah',
]);

const isLegacySeed = (r: RecentDestination) =>
  typeof r.lat !== 'number' &&
  LEGACY_SEED.has(`${r.name.toLowerCase()}|${(r.hint ?? '').toLowerCase()}`);

/** The visitor's own recent destinations, newest first. Empty until they search. */
export function loadRecents(): RecentDestination[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RecentDestination[];
      if (Array.isArray(parsed)) {
        // Defensive cap so a user with an over-capacity list from an
        // earlier build sees the new limit without needing a fresh search.
        return parsed.filter((r) => r && typeof r.name === 'string' && !isLegacySeed(r)).slice(0, MAX);
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function pushRecent(entry: RecentDestination): RecentDestination[] {
  const current = loadRecents();
  const deduped = current.filter(
    (r) => r.name.toLowerCase() !== entry.name.toLowerCase(),
  );
  const next = [entry, ...deduped].slice(0, MAX);
  try {
    persist(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
