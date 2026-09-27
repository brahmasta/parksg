/**
 * Placing the LTA_DATAGOV long tail on the map.
 *
 * The Nov-2018 data.gov.sg "Carpark Rates" CSV (d_9f6056bdb6b1dfba57f063593e4f34ae)
 * carries no coordinates, so every standalone row it creates is invisible to
 * `fetchNearbyCarparks`. `scripts/geocode-lta-datagov.ts` matches those rows to
 * OneMap buildings and writes the reviewed result to
 * `scripts/data/lta-datagov-coords.json`; `migrateLtaCsv` reads that file each
 * time it recreates the rows, so the coordinates survive a full sync.
 *
 * Everything here is pure (no I/O) so the CLI and its tests share one rulebook:
 *   - a building only counts when its NAME matches the carpark's name;
 *   - rows with no usable price stay hidden (they'd show an invented rate);
 *   - rows that duplicate a carpark we already map, or that closed, are skipped;
 *   - two CSV rows for the same building collapse to one pin.
 */

import { coreTokens, matchTier, tokens } from '../../src/lib/destinationMatch';
import { haversineMeters } from '../../src/lib/geo';

// ──────────────────────────────────────────────────────────────────────
// The committed coordinates file
// ──────────────────────────────────────────────────────────────────────

export type CoordSource = 'onemap-2017' | 'onemap-search' | 'manual';

export type LtaDataGovCoord = {
  /** The CSV carpark name, so a reviewer can read the file without the DB. */
  name: string;
  lat: number;
  lng: number;
  address: string;
  /** The OneMap BUILDING the name was matched to. */
  matchedBuilding: string;
  source: CoordSource;
};

/** Keyed by carpark id (`LTA:<slug of the CSV name>`). */
export type LtaDataGovCoordsFile = Record<string, LtaDataGovCoord>;

/**
 * Where `migrateLtaCsv` should put a standalone it is (re)creating: the reviewed
 * point from the coords file, but only while the rows it just parsed still carry
 * a usable price — a CSV re-publish that breaks the parse must not leave a pin
 * showing the invented placeholder rate.
 */
export function standalonePlacement(
  carparkId: string,
  rateRows: DbRateRowLike[],
  coords: LtaDataGovCoordsFile,
): { lat: number; lng: number; address: string } | null {
  const c = coords[carparkId];
  if (!c || !hasUsablePrice(rateRows)) return null;
  return { lat: c.lat, lng: c.lng, address: c.address };
}

// ──────────────────────────────────────────────────────────────────────
// Rates
// ──────────────────────────────────────────────────────────────────────

export type DbRateRowLike = {
  per_block_cents: number;
  block_minutes: number;
  first_hour_cents: number | null;
  per_entry_cents: number | null;
};

/**
 * True when at least one row is both shown by the app and priceable by it.
 *
 * Without such a row the app replaces the schedule with the `ratesFor('LTA')`
 * placeholder and prices it at the invented $1.60/30min (tagged MANUAL, so the
 * "2018 rate" badge doesn't even show). That happens when every CSV cell failed
 * to parse (migrateLtaCsv's 0/0 stub rows, which `bucketRateRows` hides) or when
 * the only rates were "Free" / per-entry strings that `rateRowToDb` drops.
 */
export function hasUsablePrice(rows: DbRateRowLike[]): boolean {
  return rows.some((r) => {
    const hiddenStub =
      r.per_block_cents === 0 && r.block_minutes === 0 && r.per_entry_cents == null;
    const priceable =
      (r.per_block_cents > 0 && r.block_minutes > 0) ||
      r.first_hour_cents != null ||
      r.per_entry_cents != null;
    return !hiddenStub && priceable;
  });
}

// ──────────────────────────────────────────────────────────────────────
// Names
// ──────────────────────────────────────────────────────────────────────

const FORMERLY = /^(?:formerly|formally|fomerly|former)\s+/i;

/**
 * Names to try for one CSV carpark, strongest first:
 *   1. as written                     "Hub Synergy Point (Formerly Apex tower)"
 *   2. without the (…) asides         "Hub Synergy Point"
 *   3. each "/", "," or " - " part     "Keppel Bay Tower", "Harbourfront Tower One"
 *   4. the asides themselves          "Apex tower"
 * Parts and asides need two words (or an explicit "formerly"): a lone
 * "(Tampines)" or "(STC)" names an area or an acronym, not the building.
 */
export function nameVariants(name: string): string[] {
  const asides: string[] = [];
  // The CSV has one unclosed "( Park at Fort Canning" — treat end-of-string as ")".
  const stripped = name
    .replace(/\(([^)]*)(?:\)|$)/g, (_, inner: string) => {
      asides.push(inner.trim());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();

  const out: string[] = [];
  const seen = new Set<string>();
  const add = (v: string, minWords: number) => {
    const t = tokens(v);
    const key = t.join(' ');
    if (t.length < minWords || seen.has(key)) return;
    seen.add(key);
    out.push(v.trim());
  };

  add(name, 1);
  add(stripped, 1);
  for (const part of stripped.split(/\s*[/,]\s*|\s+[-@]\s+/)) add(part, 2);
  for (const aside of asides) {
    if (FORMERLY.test(aside)) add(aside.replace(FORMERLY, ''), 1);
    else add(aside, 2);
  }
  return out;
}

/** destinationMatch's core words, also without "hotel": OneMap names hotels
 * without it ("MANDARIN ORIENTAL, SINGAPORE", "HOTEL GRAND PACIFIC"). */
function core(words: string[]): string[] {
  const c = coreTokens(words).filter((t) => t !== 'hotel');
  return c.length > 0 ? c : coreTokens(words);
}

function spaceless(words: string[]): string {
  return core(words).join('');
}

/** `needle` appears as a contiguous run inside `hay`. */
function containsRun(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((t, j) => hay[i + j] === t)) return true;
  }
  return false;
}

/** Words that make a name a street (URA's "Beach Road", "Service Road Off
 * Upper Bukit Timah Road") rather than a building. */
const STREET = new Set([
  'road', 'rd', 'street', 'st', 'avenue', 'ave', 'drive', 'lane', 'jalan', 'lorong',
  'service', 'off',
]);

/**
 * Loose "same place" name test for duplicate detection, always paired with a
 * distance guard. Beyond destinationMatch's tiers it accepts run-together names
 * ("orchardgateway" ↔ "Orchard Gateway") and a two-word core inside a longer one
 * ("CQ @ Clarke Quay" ↔ "Clarke Quay", "Cathay Cineleisure Orchard" ↔ "Cineleisure Orchard").
 * Containment involving a street name doesn't count: "PARKROYAL on Beach Road"
 * is not URA's "Beach Road" kerbside carpark.
 */
export function sameCarparkName(a: string, b: string): boolean {
  for (const va of nameVariants(a)) {
    for (const vb of nameVariants(b)) {
      if (matchTier(va, vb)) return true;
      const ca = core(tokens(va));
      const cb = core(tokens(vb));
      if (ca.length === 0 || cb.length === 0) continue;
      if (spaceless(tokens(va)) === spaceless(tokens(vb))) return true;
      const [longer, shorter] = ca.length >= cb.length ? [ca, cb] : [cb, ca];
      const streety = longer.some((t) => STREET.has(t));
      if (shorter.length >= 2 && !streety && containsRun(longer, shorter)) return true;
    }
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────
// Buildings (OneMap)
// ──────────────────────────────────────────────────────────────────────

export type Building = {
  /** OneMap BUILDING, e.g. "TAMPINES JUNCTION" ('' when OneMap has none). */
  name: string;
  /** Display address, e.g. "300 Tampines Avenue 5, Singapore 529653". */
  address: string;
  postal: string;
  lat: number;
  lng: number;
  /** Block number and road, for rows the CSV names by address. */
  blk?: string;
  road?: string;
};

export type BuildingIndex = Map<string, Building[]>;

type BuildingTier = 'exact' | 'core' | 'spaceless' | 'address';
type NameTier = Exclude<BuildingTier, 'address'>;

function buildingKey(tier: NameTier, words: string[]): string {
  if (tier === 'exact') return `e:${words.join(' ')}`;
  if (tier === 'core') return `c:${core(words).join(' ')}`;
  return `s:${spaceless(words)}`;
}

const TIERS: NameTier[] = ['exact', 'core', 'spaceless'];

/** "25 Toa Payoh Lorong 8" — a block number, then a road. */
const ADDRESS = /^(\d+[a-z]?)\s+(\D.*)$/i;
const ROAD_ABBREV: Record<string, string> = {
  rd: 'road', st: 'street', ave: 'avenue', dr: 'drive', cres: 'crescent',
};

/** Word order is ignored: the CSV writes "Toa Payoh Lorong 8", OneMap "LORONG 8 TOA PAYOH". */
function addressKey(blk: string, road: string): string {
  const words = tokens(road).map((t) => ROAD_ABBREV[t] ?? t);
  return `a:${blk.toLowerCase()} ${words.sort().join(' ')}`;
}

/** Index every building under each of its own name variants — "ALEXANDRA
 * RETAIL CENTRE (ARC)" also answers to "Alexandra Retail Centre", "SHAW PLAZA -
 * TWIN HEIGHTS" to "Shaw Plaza" — and under its block + road. */
export function indexBuildings(buildings: Iterable<Building>): BuildingIndex {
  const index: BuildingIndex = new Map();
  const push = (key: string, b: Building) => {
    const list = index.get(key);
    if (list) list.push(b);
    else index.set(key, [b]);
  };
  for (const b of buildings) {
    if (b.blk && b.road) push(addressKey(b.blk, b.road), b);
    if (!b.name || b.name.trim().toUpperCase() === 'NIL') continue;
    for (const variant of nameVariants(b.name)) {
      const words = tokens(variant);
      if (words.length === 0) continue;
      for (const tier of TIERS) push(buildingKey(tier, words), b);
    }
  }
  return index;
}

/** Candidates spread wider than this are different places, not one complex… */
export const CLUSTER_SPREAD_M = 300;
/** …unless they all carry the very same name: a campus such as Singapore Expo
 * or Gillman Barracks, which OneMap lists once per block. */
export const CAMPUS_SPREAD_M = 700;

export type BuildingLookup =
  | { kind: 'match'; building: Building; tier: BuildingTier; variant: string }
  | { kind: 'weak'; building: Building; tier: BuildingTier; variant: string }
  | { kind: 'ambiguous'; variant: string; candidates: Building[]; spreadM: number }
  | { kind: 'none' };

function maxSpread(points: Building[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, haversineMeters(points[i], points[j]));
    }
  }
  return max;
}

/** The candidate with the smallest total distance to the others — a stable
 * "middle" for a complex that OneMap lists under several postal codes. */
function medoid(points: Building[]): Building {
  let best = points[0];
  let bestSum = Infinity;
  for (const p of points) {
    const sum = points.reduce((acc, q) => acc + haversineMeters(p, q), 0);
    if (sum < bestSum || (sum === bestSum && p.postal < best.postal)) {
      best = p;
      bestSum = sum;
    }
  }
  return best;
}

/** The name as written, minus case and punctuation — "UOB PLAZA" but not "UOB THE PLAZA". */
function literal(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** One building for a set of same-named candidates, or null when they are
 * genuinely different places. */
function settle(variant: string, candidates: Building[]): Building | null {
  // Normalising and indexing name variants can merge distinct names ("UOB Plaza"
  // ↔ "UOB THE PLAZA", a bank branch 2 km away; "One Fullerton" ↔ "MERLION PARK
  // (ONE FULLERTON)" next door) — prefer the ones spelled exactly like the carpark.
  const spelled = candidates.filter((b) => literal(b.name) === literal(variant));
  const pool = spelled.length > 0 ? spelled : candidates;
  const spread = maxSpread(pool);
  if (spread <= CLUSTER_SPREAD_M) return medoid(pool);
  const oneName = pool.every((b) => literal(b.name) === literal(pool[0].name));
  if (oneName && spread <= CAMPUS_SPREAD_M) return medoid(pool);
  return null;
}

/**
 * Find the OneMap building whose name matches the carpark's. A match on the
 * full words is trusted; a match that only holds once generic words are
 * dropped is trusted when two or more distinctive words remain ("Bukit Timah
 * Plaza (Multi-Storey Car Park)" ↔ "BUKIT TIMAH PLAZA"). A single remaining
 * word is reported as weak for a human to confirm — either after dropping
 * generic words ("Central Mall" ↔ "THE CENTRAL") or after dropping an aside
 * ("IKEA (Alexandra)" → "IKEA", which OneMap only knows in Tampines).
 *
 * A name that is an address ("25 Toa Payoh Lorong 8") matches by block + road.
 * `aliases` come from hand review (renames, acronyms, addresses) and are tried
 * first and trusted as strong.
 */
export function lookupBuilding(
  name: string,
  index: BuildingIndex,
  aliases: string[] = [],
): BuildingLookup {
  const asWritten = tokens(name).join(' ');
  let fallback: BuildingLookup = { kind: 'none' };
  const noteDoubt = (doubt: BuildingLookup) => {
    if (fallback.kind === 'none') fallback = doubt;
  };
  // One candidate per postal code, labelled by the name most like the carpark's,
  // then the shortest — the building ("AMARA SINGAPORE", "OUE DOWNTOWN") rather
  // than a tenant ("UOB 100AM", "OAKWOOD PREMIER OUE SINGAPORE").
  const wanted = new Set([name, ...aliases].flatMap((n) => core(tokens(n))));
  const rank = (b: Building): [number, number, number] => [
    b.name ? 0 : 1,
    core(tokens(b.name)).some((t) => wanted.has(t)) ? 0 : 1,
    b.name.length,
  ];
  const outranks = (a: Building, b: Building) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i];
    return false;
  };
  const candidatesFor = (hits: Building[]) => {
    const byPostal = new Map<string, Building>();
    for (const h of hits) {
      const cur = byPostal.get(h.postal);
      if (!cur || outranks(h, cur)) byPostal.set(h.postal, h);
    }
    return [...byPostal.values()];
  };
  const ambiguous = (variant: string, candidates: Building[]): BuildingLookup => ({
    kind: 'ambiguous',
    variant,
    candidates,
    spreadM: Math.round(maxSpread(candidates)),
  });

  const variants = [
    ...aliases.map((v) => ({ v, trusted: true })),
    ...nameVariants(name).map((v) => ({ v, trusted: false })),
  ];
  for (const { v: variant, trusted } of variants) {
    const addr = ADDRESS.exec(variant.trim());
    const addrHits = addr ? index.get(addressKey(addr[1], addr[2])) : undefined;
    if (addrHits && addrHits.length > 0) {
      const candidates = candidatesFor(addrHits);
      const building = settle(variant, candidates);
      if (building) return { kind: 'match', building, tier: 'address', variant };
      noteDoubt(ambiguous(variant, candidates));
      continue;
    }

    const words = tokens(variant);
    for (const tier of TIERS) {
      const hits = index.get(buildingKey(tier, words));
      if (!hits || hits.length === 0) continue;
      const candidates = candidatesFor(hits);
      const building = settle(variant, candidates);
      if (!building) {
        noteDoubt(ambiguous(variant, candidates));
        break;
      }
      const oneWord = core(words).length < 2;
      const weak = !trusted && oneWord && (tier !== 'exact' || words.join(' ') !== asWritten);
      if (!weak) return { kind: 'match', building, tier, variant };
      noteDoubt({ kind: 'weak', building, tier, variant });
      break;
    }
  }
  return fallback;
}

// ──────────────────────────────────────────────────────────────────────
// Carparks we already map
// ──────────────────────────────────────────────────────────────────────

export type PlacedCarpark = { id: string; name: string; lat: number; lng: number };

/** A same-named carpark this close is the one we already serve better. */
export const DUPLICATE_RADIUS_M = 150;
/** Any mapped carpark this close gets a "check it" note, whatever its name. */
export const NEARBY_REVIEW_M = 60;

export function findDuplicate(
  name: string,
  point: { lat: number; lng: number },
  placed: PlacedCarpark[],
): { carpark: PlacedCarpark; meters: number } | null {
  let best: { carpark: PlacedCarpark; meters: number } | null = null;
  for (const cp of placed) {
    const meters = haversineMeters(point, cp);
    if (meters > DUPLICATE_RADIUS_M) continue;
    if (!sameCarparkName(name, cp.name)) continue;
    if (!best || meters < best.meters) best = { carpark: cp, meters: Math.round(meters) };
  }
  return best;
}

function nearestWithin(
  point: { lat: number; lng: number },
  placed: PlacedCarpark[],
  radiusM: number,
): { carpark: PlacedCarpark; meters: number } | null {
  let best: { carpark: PlacedCarpark; meters: number } | null = null;
  for (const cp of placed) {
    const meters = haversineMeters(point, cp);
    if (meters <= radiusM && (!best || meters < best.meters)) {
      best = { carpark: cp, meters: Math.round(meters) };
    }
  }
  return best;
}

// ──────────────────────────────────────────────────────────────────────
// Hand review
// ──────────────────────────────────────────────────────────────────────

export type ReviewDecision =
  | { skip: string }
  | { accept: string }
  | { alias: string[]; note: string }
  | { place: Omit<LtaDataGovCoord, 'name' | 'source'>; note: string };

/**
 * Outcomes decided by a person, keyed by carpark id. `skip` keeps a row off the
 * map even though it geocodes (closed, renamed into a carpark we already carry,
 * or the same carpark under another name); `accept` confirms a weak match;
 * `alias` gives the name (or "<block> <road>" address) OneMap knows it by.
 * Reviewed 2026-09-27 against the dry-run output; closures checked against news
 * and operator sources that day.
 */
export const REVIEWED: Record<string, ReviewDecision> = {
  // ── Closed or gone ──
  'LTA:liang_court': { skip: 'closed — demolished 2020 for CanningHill Square' },
  'LTA:underwater_world_singapore': { skip: 'closed — shut 2016' },
  'LTA:jurong_bird_park': { skip: 'closed — moved to Mandai as Bird Paradise, 2023' },
  'LTA:golden_mile_complex': { skip: 'closed — vacated 2022 for redevelopment' },
  'LTA:pearl_s_centre': { skip: 'closed — demolished' },
  'LTA:8_shenton_way': { skip: 'closed — AXA Tower site, demolished' },
  'LTA:hilton_hotel': {
    skip: 'closed — Hilton left 581 Orchard Rd in 2022; "Hilton Singapore Orchard" is LTA:12',
  },
  'LTA:golden_shoe_complex': { skip: 'closed — demolished; CapitaSpring stands on the site' },
  'LTA:novotel_clarke_quay': { skip: 'closed — part of the Liang Court site, shut 2020' },
  'LTA:comcentre_exeter_rd': { skip: 'closed — Singtel moved out 2024; rebuilding until 2028' },
  'LTA:clifford_centre': { skip: 'closed — vacated end-2022; rebuilding until 2028' },
  'LTA:tanglin_shopping_centre': { skip: 'closed — collective sale; demolished 2024' },
  'LTA:keypoint': { skip: 'closed — 371 Beach Rd was rebuilt as City Gate' },

  // ── The same carpark as one we already map ──
  'LTA:mandarin_orchard_singapore': {
    skip: 'renamed — the hotel reopened as Hilton Singapore Orchard in 2022 (LTA:12)',
  },
  'LTA:meritus_mandarin_singapore': {
    skip: 'renamed — the old name of Mandarin Orchard, now Hilton Singapore Orchard (LTA:12)',
  },
  'LTA:mandarin_gallery': {
    skip: 'same carpark as Hilton Singapore Orchard (LTA:12) — one building, 333 Orchard Rd',
  },
  'LTA:singapore_marriott_hotel': { skip: 'same carpark as Tangs (LTA:18) — Tang Plaza' },
  'LTA:conrad_centennial_singapore': {
    skip: 'same carpark as Millenia Singapore (LTA:5) — identical 2018 rates',
  },
  'LTA:conrad_centennial_hotel': {
    skip: 'same carpark as Millenia Singapore (LTA:5) — identical 2018 rates',
  },
  'LTA:the_ritz_carlton_millenia_singapore': {
    skip: 'same carpark as Millenia Singapore (LTA:5) — identical 2018 rates',
  },
  'LTA:toa_payoh_hdb_hub': { skip: 'same carpark as HDB:HDBH (HDB Hub), which has live lots' },
  'LTA:inter_continental_singapore_hotel': {
    skip: 'no carpark of its own — Bugis Junction\'s rates; its Hotels-category twin says "Car park at Parco Bugis Junction"',
  },
  'LTA:iluma': { skip: 'renamed — Bugis+ since 2012 (LTA:61)' },
  'LTA:the_esplanade': { skip: 'same carpark as LTA:4 "Esplanade — Theatres on the Bay"' },
  'LTA:d_resort': { skip: 'same carpark as Downtown East (LTA:downtown_east) — one complex' },
  'LTA:grand_mecure_roxy_hotel': {
    skip: 'misspelt copy of "Grand Mercure Roxy Hotel" — Roxy Square\'s carpark',
  },

  // ── Weak matches confirmed ──
  'LTA:pomo_fomerly_paradiz_centre': {
    accept: 'POMO at 1 Selegie Rd is the building; renamed GR.iD in 2021',
  },

  // ── Names OneMap knows them by ──
  'LTA:tampines_junction': { alias: ['Income at Tampines Junction'], note: 'renamed' },
  'LTA:heartland_mall': { alias: ['Heartland Mall-Kovan'], note: 'OneMap name' },
  'LTA:winsland_house': { alias: ['Winsland House I'], note: 'OneMap name (3 Killiney Rd)' },
  'LTA:nuh': { alias: ['National University Hospital'], note: 'acronym' },
  'LTA:yishun_ys_one': { alias: ['YS-ONE'], note: 'OneMap name' },
  'LTA:singapore_science_centre_singapore_discovery_centre_snow_cit': {
    alias: ['Science Centre Singapore'],
    note: 'the Science Centre, not Snow City (closing 30 Sep 2026)',
  },
  'LTA:regent_hotel': { alias: ['The Regent Singapore'], note: 'OneMap name' },
  'LTA:ramada_hotel': { alias: ['Ramada Singapore at Zhongshan Park'], note: 'OneMap name' },
  'LTA:holiday_inn_express_singapore': {
    alias: ['Holiday Inn Express Singapore Orchard Road'],
    note: 'the Orchard one (CSV category "Orchard Area")',
  },
  'LTA:traders_hotel': { alias: ['Hotel Jen Tanglin Singapore'], note: 'renamed 2014' },
  'LTA:landmark_village_hotel': { alias: ['Village Hotel Bugis'], note: 'renamed' },
  'LTA:landmark_village_hotel_formally_golden_landmark_hotel': {
    alias: ['Village Hotel Bugis'],
    note: 'renamed',
  },
  'LTA:changi_village_hotel': { alias: ['Village Hotel Changi'], note: 'renamed' },
  'LTA:amara_hotel': { alias: ['165 Tanjong Pagar Road'], note: 'the hotel\'s address' },
  'LTA:starhub_centre': { alias: ['51 Cuppage Road'], note: 'StarHub Centre\'s address' },
  'LTA:tripleone_somerset': { alias: ['111 Somerset Road'], note: 'renamed 111 Somerset' },
  'LTA:orchard_parade_hotel': {
    alias: ['1 Tanglin Road'],
    note: 'the hotel\'s address (since renamed Orchard Rendezvous, then voco Orchard)',
  },
  'LTA:dbs_building': { alias: ['6 Shenton Way'], note: 'renamed OUE Downtown' },
  'LTA:pwc_building': { alias: ['8 Cross Street'], note: 'renamed Manulife Tower' },
};

/** Hand-given names for a row, if any (also queried against OneMap search). */
export function reviewAliases(
  id: string,
  reviewed: Record<string, ReviewDecision> = REVIEWED,
): string[] {
  const d = reviewed[id];
  return d && 'alias' in d ? d.alias : [];
}

// ──────────────────────────────────────────────────────────────────────
// The plan: one outcome per LTA_DATAGOV row
// ──────────────────────────────────────────────────────────────────────

export type LtaDataGovRow = {
  id: string;
  name: string;
  category: string | null;
  rateRows: DbRateRowLike[];
  /** The CSV's four raw rate strings, joined — they sometimes say where to park. */
  rateText?: string;
};

/** "(Car Park at Marina Square)", "( Park at Clarke Quay)": the row describes
 * someone else's carpark, which is either mapped already or not a building. */
const PARK_AT = /\b(?:car\s*park|park)\s+at\s+([^();.|]+)/i;

export function parksElsewhere(row: Pick<LtaDataGovRow, 'name' | 'rateText'>): string | null {
  const m = PARK_AT.exec(`${row.name} | ${row.rateText ?? ''}`);
  return m ? m[0].trim() : null;
}

export type BuildingSource = { source: CoordSource; index: BuildingIndex };

export type PlanInput = {
  rows: LtaDataGovRow[];
  /** Tried in order; the first source with a name match wins. */
  buildings: BuildingSource[];
  /** Carparks already on the map (DB rows with coordinates + curated entries). */
  placed: PlacedCarpark[];
  /** Rows with MANUAL rate_rows: the sync never recreates them, so JSON can't reach them. */
  protectedIds: Set<string>;
  reviewed?: Record<string, ReviewDecision>;
};

export type PlanOutcome =
  | {
      status: 'matched';
      row: LtaDataGovRow;
      coord: LtaDataGovCoord;
      how: string;
      /** A mapped carpark within NEARBY_REVIEW_M under a different name. */
      nearby?: { id: string; name: string; meters: number };
    }
  | { status: 'skipped'; row: LtaDataGovRow; reason: string }
  | { status: 'unmatched'; row: LtaDataGovRow; reason: string };

function usableRowCount(rows: DbRateRowLike[]): number {
  return rows.filter((r) => hasUsablePrice([r])).length;
}

/** Keep the better of two CSV rows that land on one building: more priced
 * rows, then an area category over the catch-all "Hotels" listing, then id. */
function preferred(a: LtaDataGovRow, b: LtaDataGovRow): LtaDataGovRow {
  const ua = usableRowCount(a.rateRows);
  const ub = usableRowCount(b.rateRows);
  if (ua !== ub) return ua > ub ? a : b;
  const ha = a.category === 'Hotels';
  const hb = b.category === 'Hotels';
  if (ha !== hb) return ha ? b : a;
  return a.id <= b.id ? a : b;
}

const SAME_BUILDING_M = 50;

export function planCoords(input: PlanInput): PlanOutcome[] {
  const reviewed = input.reviewed ?? REVIEWED;
  const outcomes: PlanOutcome[] = [];

  for (const row of input.rows) {
    if (input.protectedIds.has(row.id)) {
      outcomes.push({
        status: 'skipped',
        row,
        reason: 'has MANUAL rate_rows — curated separately; the sync never recreates it',
      });
      continue;
    }
    if (!hasUsablePrice(row.rateRows)) {
      outcomes.push({
        status: 'skipped',
        row,
        reason: 'no usable price — would show the invented $1.60/30min placeholder',
      });
      continue;
    }
    const elsewhere = parksElsewhere(row);
    if (elsewhere) {
      outcomes.push({
        status: 'skipped',
        row,
        reason: `no carpark of its own — the CSV says "${elsewhere}"`,
      });
      continue;
    }
    const decision = reviewed[row.id];
    if (decision && 'skip' in decision) {
      outcomes.push({ status: 'skipped', row, reason: decision.skip });
      continue;
    }
    if (decision && 'place' in decision) {
      outcomes.push({
        status: 'matched',
        row,
        coord: { name: row.name, ...decision.place, source: 'manual' },
        how: `placed by hand — ${decision.note}`,
      });
      continue;
    }

    // A strong match from any source wins; otherwise keep the first weak or
    // ambiguous result to explain why the row stays off the map.
    let found: { building: Building; source: CoordSource; how: string } | null = null;
    let doubt: Exclude<BuildingLookup, { kind: 'match' | 'none' }> | null = null;
    const aliases = reviewAliases(row.id, reviewed);
    for (const { source, index } of input.buildings) {
      const hit = lookupBuilding(row.name, index, aliases);
      const accepted = hit.kind === 'weak' && decision && 'accept' in decision;
      if (hit.kind === 'match' || accepted) {
        const note = accepted
          ? ` (weak, accepted: ${(decision as { accept: string }).accept})`
          : aliases.includes(hit.variant)
            ? ` (alias: ${(decision as { note: string }).note})`
            : '';
        found = {
          building: hit.building,
          source,
          how: `${hit.tier} match on "${hit.variant}" → ${hit.building.name || hit.building.address}${note}`,
        };
        break;
      }
      if (hit.kind !== 'none' && !doubt) doubt = hit;
    }
    if (!found) {
      if (doubt?.kind === 'weak') {
        // A weak match can still prove a duplicate ("orchardgateway" ↔ Orchard Gateway).
        const dup = findDuplicate(row.name, doubt.building, input.placed);
        if (dup) {
          outcomes.push({
            status: 'skipped',
            row,
            reason: `duplicate of ${dup.carpark.id} "${dup.carpark.name}" (${dup.meters} m)`,
          });
          continue;
        }
      }
      const reason =
        doubt?.kind === 'weak'
          ? `weak match — only "${coreTokens(tokens(doubt.variant)).join(' ')}" matches ${doubt.building.name} (${doubt.building.address}); confirm with an \`accept\` review`
          : doubt?.kind === 'ambiguous'
            ? `ambiguous — ${doubt.candidates.length} buildings named like "${doubt.variant}" spread ${doubt.spreadM} m apart`
            : 'no OneMap building with this name';
      outcomes.push({ status: 'unmatched', row, reason });
      continue;
    }

    const dup = findDuplicate(row.name, found.building, input.placed);
    if (dup) {
      outcomes.push({
        status: 'skipped',
        row,
        reason: `duplicate of ${dup.carpark.id} "${dup.carpark.name}" (${dup.meters} m)`,
      });
      continue;
    }
    const near = nearestWithin(found.building, input.placed, NEARBY_REVIEW_M);
    outcomes.push({
      status: 'matched',
      row,
      coord: {
        name: row.name,
        lat: found.building.lat,
        lng: found.building.lng,
        address: found.building.address,
        matchedBuilding: found.building.name || found.building.address,
        source: found.source,
      },
      how: found.how,
      ...(near
        ? { nearby: { id: near.carpark.id, name: near.carpark.name, meters: near.meters } }
        : {}),
    });
  }

  return collapseSameBuilding(outcomes);
}

/** Two CSV rows on one building ("Grand Hyatt Hotel" under Hotels and "Grand
 * Hyatt Singapore" under Orchard) would stack two pins — keep one. */
function collapseSameBuilding(outcomes: PlanOutcome[]): PlanOutcome[] {
  const matched = outcomes.filter(
    (o): o is Extract<PlanOutcome, { status: 'matched' }> => o.status === 'matched',
  );
  const loser = new Map<string, string>(); // dropped id → kept id
  for (let i = 0; i < matched.length; i++) {
    for (let j = i + 1; j < matched.length; j++) {
      const a = matched[i];
      const b = matched[j];
      if (loser.has(a.row.id) || loser.has(b.row.id)) continue;
      const sameAddress = a.coord.address === b.coord.address;
      const close = haversineMeters(a.coord, b.coord) <= SAME_BUILDING_M;
      if (!sameAddress && !(close && sameCarparkName(a.row.name, b.row.name))) continue;
      const keep = preferred(a.row, b.row);
      const drop = keep === a.row ? b.row : a.row;
      loser.set(drop.id, keep.id);
    }
  }
  if (loser.size === 0) return outcomes;
  return outcomes.map((o) => {
    const keptId = loser.get(o.row.id);
    if (o.status !== 'matched' || !keptId) return o;
    return { status: 'skipped', row: o.row, reason: `same building as ${keptId} — keeping one pin` };
  });
}

/** The committed file: matched outcomes only, sorted by id for stable diffs. */
export function coordsFileFrom(outcomes: PlanOutcome[]): LtaDataGovCoordsFile {
  const out: LtaDataGovCoordsFile = {};
  const matched = outcomes
    .filter((o): o is Extract<PlanOutcome, { status: 'matched' }> => o.status === 'matched')
    .sort((a, b) => (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0));
  for (const o of matched) {
    out[o.row.id] = {
      ...o.coord,
      lat: +o.coord.lat.toFixed(6),
      lng: +o.coord.lng.toFixed(6),
    };
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// OneMap record → Building
// ──────────────────────────────────────────────────────────────────────

/** The fields shared by the OneMap search API and the 2017 postal-code dump. */
export type OneMapRecord = {
  BUILDING?: string;
  SEARCHVAL?: string;
  BLK_NO?: string;
  ROAD_NAME?: string;
  POSTAL?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
};

function titleWords(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

const clean = (s: string | undefined) => {
  const t = (s ?? '').trim();
  return t === 'NIL' ? '' : t;
};

/** Records without a building name are kept: they still anchor an address. */
export function buildingFromOneMap(r: OneMapRecord): Building | null {
  const lat = Number(r.LATITUDE);
  const lng = Number(r.LONGITUDE);
  if (!r.LATITUDE || !r.LONGITUDE || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // The dump writes BUILDING "NIL" and an address in SEARCHVAL — not a name.
  const name = r.BUILDING !== undefined ? clean(r.BUILDING) : clean(r.SEARCHVAL);
  const blk = clean(r.BLK_NO);
  const road = clean(r.ROAD_NAME);
  const postal = clean(r.POSTAL);
  if (!name && !(blk && road)) return null;
  const street = titleWords([blk, road].filter(Boolean).join(' '));
  const address = [street, postal ? `Singapore ${postal}` : ''].filter(Boolean).join(', ');
  return { name, address, postal, lat, lng, ...(blk && road ? { blk, road } : {}) };
}
