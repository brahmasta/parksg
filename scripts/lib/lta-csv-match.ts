/**
 * Name matching for the LTA 2018 CSV (data.gov.sg) import in
 * scripts/migrate-to-supabase.ts: which existing carparks a CSV row's rates
 * belong to. The CSV has no ids or coordinates, so the name is all there is.
 */

/** Lower-case, "&" → "and", punctuation → spaces ("@" kept: "313@Somerset"). */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9@ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Words that say what kind of building, or which section of it, rather than
 * which building (as GENERIC / SECTION_LABEL in src/lib/destinationMatch.ts).
 */
const GENERIC = new Set([
  'mall', 'shopping', 'centre', 'center', 'building', 'complex',
  'car', 'park', 'carpark', 'basement', 'multi', 'storey',
]);
const SECTION_LABEL = /^[pb]\d{1,2}$/;
const isGeneric = (w: string) => GENERIC.has(w) || SECTION_LABEL.test(w);

/**
 * One name starts the other on a word boundary ("Vivocity P3 Carpark" ↔
 * "Vivocity P3"). A one-word name is too broad to do that on its own — "Bugis+"
 * normalises to "bugis", which would claim "Bugis Junction" across Victoria
 * Street — so it needs the rest of the longer name to be generic: "Vivocity" ↔
 * "Vivocity P2", "NEX" ↔ "Nex Mall". Same ≥2-word rule as the prefix tier in
 * src/lib/destinationMatch.ts, whose core tier covers the generic case.
 */
function isPrefixMatch(a: string[], b: string[]): boolean {
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  if (shorter.length === longer.length) return false;
  if (!shorter.every((w, i) => longer[i] === w)) return false;
  return shorter.length >= 2 || longer.slice(shorter.length).every(isGeneric);
}

/**
 * Matcher over the existing carparks (id → name). Returns the ids a CSV name
 * belongs to: the exact normalised match when there is one, else every prefix
 * match — the CSV's "Vivocity" legitimately covers both Vivocity P2 and P3.
 */
export function makeCsvNameMatcher(
  namesById: Map<string, string>,
): (rawName: string) => string[] {
  const idByName = new Map<string, string>();
  for (const [id, n] of namesById) idByName.set(normaliseName(n), id);
  const byWords = [...idByName].map(([k, id]) => [k.split(' '), id] as const);

  return (rawName) => {
    const norm = normaliseName(rawName);
    if (!norm) return [];
    const exact = idByName.get(norm);
    if (exact) return [exact];
    const words = norm.split(' ');
    return byWords.filter(([k]) => isPrefixMatch(words, k)).map(([, id]) => id);
  };
}
