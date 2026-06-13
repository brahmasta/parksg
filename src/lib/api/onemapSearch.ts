/** Client for the OneMap location-search proxy (api/onemap-search.ts). */

export type OneMapPlace = { name: string; address: string; lat: number; lng: number };

/** Search OneMap for a place by free text. Resolves [] on any failure. */
export async function searchOneMap(q: string, signal?: AbortSignal): Promise<OneMapPlace[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const res = await fetch(`/api/onemap-search?q=${encodeURIComponent(term)}`, { signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: OneMapPlace[] };
    return body.results ?? [];
  } catch {
    return [];
  }
}
