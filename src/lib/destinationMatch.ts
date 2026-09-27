import type { Carpark } from './types';

/**
 * Find the carpark that belongs to the destination itself.
 *
 * Searching "Tampines Mall" used to rank Tampines Mall's own carpark ~20th:
 * cost sort puts every $0.60/30min HDB lot within 600m above a $1.35/h mall,
 * so users concluded mall carparks weren't covered at all. When the searched
 * place IS a carpark we know (same name, right next to the pin), the Results
 * list pins it to the top as "At destination" and ranks the rest normally.
 *
 * Matching is name-first, with a distance guard so a same-named place across
 * the island can't be pinned. Three tiers, strongest first:
 *   1. exact   — names equal after light normalisation
 *                ("Tampines Mall" ↔ "TAMPINES MALL", "Six Battery Road" ↔ "6 Battery Road")
 *   2. core    — equal once generic words (mall, shopping centre, building…)
 *                are dropped ("Funan" ↔ "Funan Mall"); tighter distance guard
 *                because a bare area name ("Tampines") also reduces to a core
 *   3. prefix  — one core name starts the other, both ≥2 words
 *                ("Asia Square Tower 1" ↔ "Asia Square")
 * Ties break on DB-over-Google, then nearest.
 */

const TIER_MAX_METERS = { exact: 400, core: 150, prefix: 250 } as const;
type Tier = keyof typeof TIER_MAX_METERS;
const TIER_RANK: Record<Tier, number> = { exact: 0, core: 1, prefix: 2 };

const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
};

/** Words that never distinguish one place from another. */
const NOISE = new Set(['the', 'singapore', 'sg', 'carpark', 'carparks', 'parking']);

/** Words that describe the kind of building rather than which one. */
const GENERIC = new Set([
  'mall', 'shopping', 'centre', 'center', 'building', 'complex',
  'car', 'park', 'basement', 'multi', 'storey',
]);

/** Normalised name words (also used by scripts/lib/lta-datagov-geo.ts). */
export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/@/g, ' ')
    .replace(/\bcar\s+park\b/g, 'carpark')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => NUMBER_WORDS[t] ?? t)
    .filter((t) => !NOISE.has(t));
}

export function coreTokens(all: string[]): string[] {
  const core = all.filter((t) => !GENERIC.has(t));
  return core.length > 0 ? core : all;
}

function startsWithWords(longer: string[], shorter: string[]): boolean {
  if (shorter.length === 0 || shorter.length > longer.length) return false;
  return shorter.every((t, i) => longer[i] === t);
}

export function matchTier(destination: string, carparkName: string): Tier | null {
  const d = tokens(destination);
  const c = tokens(carparkName);
  if (d.length === 0 || c.length === 0) return null;
  if (d.join(' ') === c.join(' ')) return 'exact';

  const dc = coreTokens(d);
  const cc = coreTokens(c);
  if (dc.join(' ') === cc.join(' ')) return 'core';

  const [longer, shorter] = dc.length >= cc.length ? [dc, cc] : [cc, dc];
  if (shorter.length >= 2 && startsWithWords(longer, shorter)) return 'prefix';
  return null;
}

/**
 * Id of the carpark at the searched destination, or null when none matches.
 * `walkMeters` on each carpark is already the distance from the destination.
 */
export function findDestinationCarparkId(
  carparks: Carpark[],
  destinationLabel: string | null | undefined,
): string | null {
  if (!destinationLabel || !destinationLabel.trim()) return null;

  let best: { cp: Carpark; tier: Tier } | null = null;
  for (const cp of carparks) {
    const tier = matchTier(destinationLabel, cp.name);
    if (!tier || cp.walkMeters > TIER_MAX_METERS[tier]) continue;
    if (!best || isBetter(cp, tier, best.cp, best.tier)) best = { cp, tier };
  }
  return best?.cp.id ?? null;
}

function isBetter(a: Carpark, aTier: Tier, b: Carpark, bTier: Tier): boolean {
  if (TIER_RANK[aTier] !== TIER_RANK[bTier]) return TIER_RANK[aTier] < TIER_RANK[bTier];
  const aGoogle = a.source === 'GOOGLE';
  const bGoogle = b.source === 'GOOGLE';
  if (aGoogle !== bGoogle) return !aGoogle;
  return a.walkMeters < b.walkMeters;
}
