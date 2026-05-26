import type { RecentDestination } from './types';

const KEY = 'psg.recents';
const MAX = 5;

const SEED: RecentDestination[] = [
  { name: 'Vivocity', hint: 'HarbourFront' },
  { name: '313 Somerset', hint: 'Orchard' },
  { name: 'Jewel Changi', hint: 'Airport' },
  { name: 'Tiong Bahru Plaza', hint: 'Bukit Merah' },
];

export function loadRecents(): RecentDestination[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RecentDestination[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Defensive cap so a user with an over-capacity list from an
        // earlier build sees the new limit without needing a fresh search.
        return parsed.slice(0, MAX);
      }
    }
  } catch {
    /* ignore */
  }
  return SEED;
}

export function pushRecent(entry: RecentDestination): RecentDestination[] {
  const current = loadRecents();
  const deduped = current.filter(
    (r) => r.name.toLowerCase() !== entry.name.toLowerCase(),
  );
  const next = [entry, ...deduped].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
