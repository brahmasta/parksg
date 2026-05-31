/**
 * Cloud sync for saved carparks + destinations.
 *
 * This app has no Supabase Auth session (sign-in is Google OAuth, identity is
 * the Google `sub`). So — exactly like `analytics.ts` — every write goes through
 * a SECURITY DEFINER RPC that takes the user id as a parameter; the underlying
 * `saved_carparks` / `saved_destinations` tables are RLS-locked and unreachable
 * directly with the anon key.
 *
 * `mergeCloudSaves` is the only call that awaits a result (sign-in hydration —
 * it returns the merged authoritative set). The incremental upsert/delete calls
 * are fire-and-forget: a save must never block on the network, and a failed
 * sync just leaves the local copy ahead until the next sign-in merge reconciles.
 */

import type {
  Operator,
  SavedCarpark,
  SavedCarparkSnapshot,
  SavedDestination,
} from '../types';

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function headers() {
  return {
    apikey: ANON_KEY as string,
    Authorization: `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

/** Await a JSON-returning RPC. Returns null on any failure (caller falls back). */
async function callRpcJson<T>(fn: string, body: Record<string, unknown>): Promise<T | null> {
  if (!URL_BASE || !ANON_KEY) return null;
  try {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as T | T[];
    // A scalar-returning function may come back bare or wrapped in a 1-row array.
    return Array.isArray(json) ? (json[0] ?? null) : json;
  } catch {
    return null;
  }
}

/** Fire-and-forget RPC — never awaited, never throws into the caller. */
function callRpcVoid(fn: string, body: Record<string, unknown>): void {
  if (!URL_BASE || !ANON_KEY) return;
  try {
    void fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* best-effort */
    });
  } catch {
    /* best-effort */
  }
}

// ── Wire shapes (snake_case, matching the SQL RPCs) ──────────────────────

type CloudCarpark = {
  carpark_id: string;
  name: string | null;
  block: string | null;
  area: string | null;
  operator: string | null;
  last_cost: number | null;
  saved_at: string; // ISO
};

type CloudDestination = {
  dest_id: string;
  name: string;
  address: string | null;
  icon: string | null;
  lat: number | null;
  lng: number | null;
  saved_at: string; // ISO
};

type MergeResult = { carparks: CloudCarpark[]; destinations: CloudDestination[] };

const DEST_ICONS = new Set(['briefcase', 'home', 'star', 'heart', 'pin', 'building']);
function asIcon(v: string | null): SavedDestination['icon'] {
  return v && DEST_ICONS.has(v) ? (v as SavedDestination['icon']) : 'pin';
}
function asOperator(v: string | null): Operator {
  return v === 'HDB' || v === 'URA' || v === 'LTA' ? v : 'LTA';
}
function iso(ms: number): string {
  return new Date(ms).toISOString();
}
function ms(isoStr: string): number {
  const t = Date.parse(isoStr);
  return Number.isFinite(t) ? t : Date.now();
}

// ── Local → wire ─────────────────────────────────────────────────────────

function carparksToWire(
  carparks: SavedCarpark[],
  snapshots: SavedCarparkSnapshot[],
): Record<string, unknown>[] {
  const byId = new Map(snapshots.map((s) => [s.id, s]));
  return carparks.map((c) => {
    const snap = byId.get(c.id);
    return {
      carpark_id: c.id,
      name: snap?.name ?? null,
      block: snap?.block ?? null,
      area: snap?.area ?? null,
      operator: snap?.operator ?? null,
      last_cost: snap?.lastCost ?? null,
      saved_at: iso(c.savedAt),
    };
  });
}

function destinationsToWire(destinations: SavedDestination[]): Record<string, unknown>[] {
  return destinations.map((d) => ({
    dest_id: d.id,
    name: d.name,
    address: d.address,
    icon: d.icon,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    saved_at: iso(d.savedAt),
  }));
}

// ── Wire → local ─────────────────────────────────────────────────────────

export type CloudSaves = {
  savedCarparks: SavedCarpark[];
  snapshots: SavedCarparkSnapshot[];
  destinations: SavedDestination[];
};

function fromMergeResult(r: MergeResult): CloudSaves {
  const savedCarparks: SavedCarpark[] = [];
  const snapshots: SavedCarparkSnapshot[] = [];
  for (const c of r.carparks ?? []) {
    const savedAt = ms(c.saved_at);
    savedCarparks.push({ id: c.carpark_id, savedAt });
    // Only build a renderable snapshot when the cloud row carries the metadata
    // (rows saved on a device that never opened Detail may lack it).
    if (c.name) {
      snapshots.push({
        id: c.carpark_id,
        name: c.name,
        block: c.block ?? '',
        area: c.area ?? '',
        operator: asOperator(c.operator),
        lastCost: typeof c.last_cost === 'number' ? c.last_cost : 0,
        savedAt,
      });
    }
  }
  const destinations: SavedDestination[] = (r.destinations ?? []).map((d) => ({
    id: d.dest_id,
    name: d.name,
    address: d.address ?? '',
    icon: asIcon(d.icon),
    lat: d.lat ?? undefined,
    lng: d.lng ?? undefined,
    savedAt: ms(d.saved_at),
  }));
  return { savedCarparks, snapshots, destinations };
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Sign-in hydration: push the local saves up (last-write-wins) and get back the
 * full merged set. Returns null if sync is unavailable/failed — caller keeps
 * the local copy untouched.
 */
export async function mergeCloudSaves(
  userId: string,
  carparks: SavedCarpark[],
  snapshots: SavedCarparkSnapshot[],
  destinations: SavedDestination[],
): Promise<CloudSaves | null> {
  const result = await callRpcJson<MergeResult>('merge_saves', {
    p_user_id: userId,
    p_carparks: carparksToWire(carparks, snapshots),
    p_destinations: destinationsToWire(destinations),
  });
  return result ? fromMergeResult(result) : null;
}

export function pushCarparkUpsert(userId: string, snap: SavedCarparkSnapshot): void {
  callRpcVoid('upsert_saved_carpark', {
    p_user_id: userId,
    p_carpark_id: snap.id,
    p_name: snap.name,
    p_block: snap.block,
    p_area: snap.area,
    p_operator: snap.operator,
    p_last_cost: snap.lastCost,
    p_saved_at: iso(snap.savedAt),
  });
}

/** Upsert a carpark id we don't have a snapshot for (id + savedAt only). */
export function pushCarparkIdUpsert(userId: string, id: string, savedAt: number): void {
  callRpcVoid('upsert_saved_carpark', {
    p_user_id: userId,
    p_carpark_id: id,
    p_name: null,
    p_block: null,
    p_area: null,
    p_operator: null,
    p_last_cost: null,
    p_saved_at: iso(savedAt),
  });
}

export function pushCarparkDelete(userId: string, id: string): void {
  callRpcVoid('delete_saved_carpark', { p_user_id: userId, p_carpark_id: id });
}

export function pushDestinationUpsert(userId: string, d: SavedDestination): void {
  callRpcVoid('upsert_saved_destination', {
    p_user_id: userId,
    p_dest_id: d.id,
    p_name: d.name,
    p_address: d.address,
    p_icon: d.icon,
    p_lat: d.lat ?? null,
    p_lng: d.lng ?? null,
    p_saved_at: iso(d.savedAt),
  });
}

export function pushDestinationDelete(userId: string, id: string): void {
  callRpcVoid('delete_saved_destination', { p_user_id: userId, p_dest_id: id });
}
