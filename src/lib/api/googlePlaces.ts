// Client wrapper for the Google Places proxies in /api.
//
// Session tokens — the same opaque string is sent on every autocomplete
// request for one typeahead session, then once more on the placeDetails call
// that finalizes the pick. Google bills the whole flow as one event.

export type PlaceSuggestion = {
  placeId: string;
  primary: string;
  secondary: string;
};

export type ResolvedPlace = {
  label: string;
  address: string;
  lat: number;
  lng: number;
};

/** A nearby car park from the Google Places (New) Nearby Search proxy.
 * Supplementary only — Google provides no rates, capacity, or live lots. */
export type NearbyGooglePlace = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  businessStatus?: string;
  /** Coarse free/paid flags from Google `parkingOptions`; null when unknown. */
  parking: { free: boolean | null; paid: boolean | null };
};

export function newSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Returns Singapore-scoped place suggestions for a partial query string.
 * Throws on network failure; returns [] for queries shorter than 2 chars. */
export async function autocomplete(
  query: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL('/api/google-places-autocomplete', window.location.origin);
  url.searchParams.set('q', q);
  url.searchParams.set('sessiontoken', sessionToken);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Autocomplete failed: ${res.status}`);
  const body = (await res.json()) as {
    ok: boolean;
    suggestions?: PlaceSuggestion[];
    error?: string;
  };
  if (!body.ok) throw new Error(body.error ?? 'Autocomplete returned ok=false');
  return body.suggestions ?? [];
}

/** Nearby car parks around a centre, for gap-filling sparse areas.
 * Returns [] on any failure (supplementary data must never break a search). */
export async function nearbyParking(
  centre: { lat: number; lng: number },
  radiusM: number,
  signal?: AbortSignal,
): Promise<NearbyGooglePlace[]> {
  const url = new URL('/api/google-places-nearby', window.location.origin);
  url.searchParams.set('lat', String(centre.lat));
  url.searchParams.set('lng', String(centre.lng));
  url.searchParams.set('radius', String(Math.round(radiusM)));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return [];
  const body = (await res.json()) as { ok: boolean; places?: NearbyGooglePlace[] };
  if (!body.ok) return [];
  return body.places ?? [];
}

/** Resolves a placeId from a previous autocomplete call into coords. */
export async function placeDetails(
  placeId: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<ResolvedPlace | null> {
  const url = new URL('/api/google-places-details', window.location.origin);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('sessiontoken', sessionToken);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Place details failed: ${res.status}`);
  const body = (await res.json()) as {
    ok: boolean;
    place?: ResolvedPlace;
    error?: string;
  };
  if (!body.ok || !body.place) return null;
  return body.place;
}
