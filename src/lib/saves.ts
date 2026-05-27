import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Carpark,
  DestIcon,
  MergedSaveItem,
  Operator,
  SavedCarpark,
  SavedCarparkSnapshot,
  SavedDestination,
} from './types';

const CARPARKS_KEY = 'psg.savedCarparks';
const SNAPSHOTS_KEY = 'psg.savedCarparkSnapshots';
const DESTINATIONS_KEY = 'psg.savedDestinations';

// Re-export so callers don't need to drill into types.
export type { SavedCarparkSnapshot };

// ────────────────────────────────────────────────────────────────────
// Persistence helpers
// ────────────────────────────────────────────────────────────────────

function readCarparks(): SavedCarpark[] {
  try {
    const raw = localStorage.getItem(CARPARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate legacy shape (string[] of ids) → SavedCarpark[].
    if (parsed.every((x) => typeof x === 'string')) {
      const now = Date.now();
      return parsed.map((id, i) => ({ id, savedAt: now - i * 1000 }));
    }
    return parsed.filter(
      (x): x is SavedCarpark =>
        x && typeof x === 'object' && typeof x.id === 'string' && typeof x.savedAt === 'number',
    );
  } catch {
    return [];
  }
}

function writeCarparks(list: SavedCarpark[]) {
  try {
    localStorage.setItem(CARPARKS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function readSnapshots(): SavedCarparkSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCarparkSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSnapshots(s: SavedCarparkSnapshot[]) {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function readDestinations(): SavedDestination[] {
  try {
    const raw = localStorage.getItem(DESTINATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate legacy shape (createdAt → savedAt).
    return parsed.map((d) => {
      if (d && typeof d === 'object' && !('savedAt' in d) && 'createdAt' in d) {
        return { ...d, savedAt: d.createdAt };
      }
      return d;
    }) as SavedDestination[];
  } catch {
    return [];
  }
}

function writeDestinations(ds: SavedDestination[]) {
  try {
    localStorage.setItem(DESTINATIONS_KEY, JSON.stringify(ds));
  } catch {
    /* ignore */
  }
}

// ────────────────────────────────────────────────────────────────────
// Snapshot builder + area derivation
// ────────────────────────────────────────────────────────────────────

/** Derive a coarse area label from a carpark when the data model doesn't
 * carry one. Pulls a postal-district hint from `block` first, then falls
 * back to the operator. Keeps the Saved feed groupings stable. */
function deriveArea(cp: { block: string; operator: Operator; name: string }): string {
  const block = cp.block ?? '';
  if (/blk\s*\d+/i.test(block)) {
    const m = block.match(/[A-Za-z][A-Za-z\s]{2,}/);
    if (m) {
      const cand = m[0].trim();
      if (cand && cand.toLowerCase() !== 'blk') return cand;
    }
  }
  if (cp.operator === 'HDB') return 'HDB carparks';
  if (cp.operator === 'URA') return 'URA carparks';
  return 'LTA carparks';
}

export function snapshotFromCarpark(cp: Carpark, lastCost: number): SavedCarparkSnapshot {
  return {
    id: cp.id,
    name: cp.name,
    block: cp.block,
    area: deriveArea(cp),
    operator: cp.operator,
    lastCost,
    savedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────
// Merge helper
// ────────────────────────────────────────────────────────────────────

/** Build the unified Saved feed: destinations + saved-carpark records,
 * decorated with a `kind` discriminator and the resolved snapshot for
 * "carpark" rows. Sorted latest-first. */
export function mergeSaves(
  savedCarparks: SavedCarpark[],
  snapshots: SavedCarparkSnapshot[],
  destinations: SavedDestination[],
): MergedSaveItem[] {
  const items: MergedSaveItem[] = [];
  for (const d of destinations) {
    items.push({ kind: 'destination', id: d.id, savedAt: d.savedAt, destination: d });
  }
  for (const sc of savedCarparks) {
    const snap = snapshots.find((s) => s.id === sc.id);
    if (!snap) continue;
    items.push({ kind: 'carpark', id: sc.id, savedAt: sc.savedAt, carpark: snap });
  }
  return items.sort((a, b) => b.savedAt - a.savedAt);
}

// ────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────

export function useSaves() {
  const [savedCarparks, setSavedCarparks] = useState<SavedCarpark[]>(() => readCarparks());
  const [snapshots, setSnapshots] = useState<SavedCarparkSnapshot[]>(() => readSnapshots());
  const [destinations, setDestinations] = useState<SavedDestination[]>(() => readDestinations());

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CARPARKS_KEY) setSavedCarparks(readCarparks());
      if (e.key === SNAPSHOTS_KEY) setSnapshots(readSnapshots());
      if (e.key === DESTINATIONS_KEY) setDestinations(readDestinations());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const savedSet = useMemo(
    () => new Set(savedCarparks.map((s) => s.id)),
    [savedCarparks],
  );

  const isCarparkSaved = useCallback((id: string) => savedSet.has(id), [savedSet]);

  const toggleCarpark = useCallback(
    (id: string, snapshot?: SavedCarparkSnapshot) => {
      setSavedCarparks((prev) => {
        const has = prev.some((s) => s.id === id);
        const next = has
          ? prev.filter((s) => s.id !== id)
          : [...prev, { id, savedAt: Date.now() }];
        writeCarparks(next);
        // Mirror the snapshot list.
        if (has) {
          setSnapshots((prevSnaps) => {
            const nextSnaps = prevSnaps.filter((s) => s.id !== id);
            writeSnapshots(nextSnaps);
            return nextSnaps;
          });
        } else if (snapshot) {
          setSnapshots((prevSnaps) => {
            const nextSnaps = [
              ...prevSnaps.filter((s) => s.id !== id),
              snapshot,
            ];
            writeSnapshots(nextSnaps);
            return nextSnaps;
          });
        }
        return next;
      });
    },
    [],
  );

  const addDestination = useCallback(
    (d: { name: string; address: string; icon: DestIcon; lat?: number; lng?: number }) => {
      const id =
        d.name.toLowerCase().replace(/\s+/g, '-') +
        '-' +
        Math.random().toString(36).slice(2, 6);
      const entry: SavedDestination = { ...d, id, savedAt: Date.now() };
      setDestinations((prev) => {
        const next = [...prev, entry];
        writeDestinations(next);
        return next;
      });
      return entry;
    },
    [],
  );

  const removeDestination = useCallback((id: string) => {
    setDestinations((prev) => {
      const next = prev.filter((d) => d.id !== id);
      writeDestinations(next);
      return next;
    });
  }, []);

  const isDestinationSaved = useCallback(
    (addressOrName: string) => {
      const q = addressOrName.trim().toLowerCase();
      if (!q) return false;
      return destinations.some(
        (d) =>
          d.name.toLowerCase() === q ||
          d.address.toLowerCase().includes(q) ||
          q.includes(d.name.toLowerCase()),
      );
    },
    [destinations],
  );

  const merged = useMemo(
    () => mergeSaves(savedCarparks, snapshots, destinations),
    [savedCarparks, snapshots, destinations],
  );

  return {
    savedCarparks,
    savedCarparkIds: savedCarparks.map((s) => s.id),
    savedCarparkSnapshots: snapshots,
    isCarparkSaved,
    toggleCarpark,
    destinations,
    addDestination,
    removeDestination,
    isDestinationSaved,
    merged,
  };
}

// ────────────────────────────────────────────────────────────────────
// Time-ago helper
// ────────────────────────────────────────────────────────────────────

export function savedAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const d = Math.floor(diff / 86_400_000);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
