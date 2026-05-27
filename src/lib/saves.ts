import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Carpark, DestIcon, Operator, SavedDestination } from './types';

const CARPARKS_KEY = 'psg.savedCarparks';
const SNAPSHOTS_KEY = 'psg.savedCarparkSnapshots';
const DESTINATIONS_KEY = 'psg.savedDestinations';

/**
 * Lightweight snapshot of a carpark, persisted so the Saved Carparks list
 * can render even when the user has never visited Results / Detail in the
 * current session. Live lot counts and EV state come back when they open
 * the carpark's Detail screen.
 */
export type SavedCarparkSnapshot = {
  id: string;
  name: string;
  block: string;
  area: string;
  operator: Operator;
  lastCost: number;
  savedAt: number;
};

function readCarparks(): string[] {
  try {
    const raw = localStorage.getItem(CARPARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeCarparks(ids: string[]) {
  try {
    localStorage.setItem(CARPARKS_KEY, JSON.stringify(ids));
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

/** Derive a coarse area label from a carpark when the data model doesn't
 * carry one. Pulls a postal-district hint from `block` first, then falls
 * back to the operator. Keeps the Saved Carparks groupings stable. */
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

export function snapshotFromCarpark(
  cp: Carpark,
  lastCost: number,
): SavedCarparkSnapshot {
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

function readDestinations(): SavedDestination[] {
  try {
    const raw = localStorage.getItem(DESTINATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDestination[];
    return Array.isArray(parsed) ? parsed : [];
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

export function useSaves() {
  const [carparkIds, setCarparkIds] = useState<string[]>(() => readCarparks());
  const [snapshots, setSnapshots] = useState<SavedCarparkSnapshot[]>(() =>
    readSnapshots(),
  );
  const [destinations, setDestinations] = useState<SavedDestination[]>(() =>
    readDestinations(),
  );

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CARPARKS_KEY) setCarparkIds(readCarparks());
      if (e.key === SNAPSHOTS_KEY) setSnapshots(readSnapshots());
      if (e.key === DESTINATIONS_KEY) setDestinations(readDestinations());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const savedCarparks = useMemo(() => new Set(carparkIds), [carparkIds]);

  const isCarparkSaved = useCallback(
    (id: string) => savedCarparks.has(id),
    [savedCarparks],
  );

  const toggleCarpark = useCallback(
    (id: string, snapshot?: SavedCarparkSnapshot) => {
      setCarparkIds((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        writeCarparks(next);
        // Mirror the snapshot list. Add when saving (need a snapshot), drop
        // when unsaving so we don't keep stale entries around.
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
      const entry: SavedDestination = { ...d, id, createdAt: Date.now() };
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

  return {
    savedCarparks,
    savedCarparkIds: carparkIds,
    savedCarparkSnapshots: snapshots,
    isCarparkSaved,
    toggleCarpark,
    destinations,
    addDestination,
    removeDestination,
    isDestinationSaved,
  };
}
