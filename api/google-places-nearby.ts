// Vercel Edge function — Google Places API (New) Nearby Search proxy.
//
// Returns nearby car parks for a lat/lng, used as SUPPLEMENTARY results to fill
// gaps where our own DB/feeds carry no carpark (private/long-tail: MCST condos,
// office towers, small commercial lots). Keeping the API key server-side avoids
// exposing it in the browser bundle.
//
// IMPORTANT — Google Maps Platform Terms of Service:
//   - Place content (names, addresses, etc.) and coordinates must NOT be
//     persisted (place IDs may be stored; lat/lng ≤30 days only). This proxy is
//     a pure pass-through transform — it imports no Supabase client and writes
//     nothing. The client holds results in memory for the session only.
//   - A "Powered by Google" attribution is shown wherever this data is rendered.
//
// Env vars:
//   GOOGLE_PLACES_API_KEY  required, same key as the autocomplete/details proxies.
//                          Enable the "Places API (New)" on the Google Cloud project.
//
// Query params:
//   lat, lng   required, search centre (WGS84)
//   radius     optional, metres (clamped 100–1500, default 600)
//   max        optional, max results (clamped 1–20, default 12)
//
// Returns:
//   200 { ok: true, places: [{ placeId, name, address, lat, lng, businessStatus,
//                              parking: { free, paid } }] }
//   400 { ok: false, error }   bad coords
//   500 { ok: false, error }   missing key
//   502 { ok: false, error }   upstream failure

export const config = { runtime: 'edge' };

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';

// Only `parking` is a documented primary type on the Places API (New). The
// `parking_garage`/`parking_lot` types are Place *types* but not valid
// includedTypes here — requesting them 400s — so we search the one type.
const INCLUDED_TYPES = ['parking'];

// Minimal field mask — Google bills per requested field, so we request only
// what the supplementary card/detail needs. (No priceLevel: too coarse to be
// useful for parking, and we render rates as "unknown" anyway.)
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.businessStatus',
  'places.parkingOptions',
].join(',');

type UpstreamPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
  parkingOptions?: {
    freeParkingLot?: boolean;
    paidParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidStreetParking?: boolean;
    freeGarageParking?: boolean;
    paidGarageParking?: boolean;
    valetParking?: boolean;
  };
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ ok: false, error: 'lat and lng query params are required' }, 400);
  }
  const radius = clamp(Number(url.searchParams.get('radius')) || 600, 100, 1500);
  const max = clamp(Number(url.searchParams.get('max')) || 12, 1, 20);

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return json({ ok: false, error: 'GOOGLE_PLACES_API_KEY not set on the server' }, 500);
  }

  const body = {
    includedTypes: INCLUDED_TYPES,
    maxResultCount: max,
    rankPreference: 'DISTANCE',
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
    languageCode: 'en',
    regionCode: 'sg',
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json(
        { ok: false, error: `Places upstream returned ${res.status}`, detail: detail.slice(0, 300) },
        502,
      );
    }

    const upstream = (await res.json()) as { places?: UpstreamPlace[] };
    const places = (upstream.places ?? [])
      .map((p) => {
        const placeId = p.id;
        const latN = p.location?.latitude;
        const lngN = p.location?.longitude;
        if (!placeId || !Number.isFinite(latN) || !Number.isFinite(lngN)) return null;
        if (p.businessStatus === 'CLOSED_PERMANENTLY') return null;
        const o = p.parkingOptions;
        const free = o
          ? !!(o.freeParkingLot || o.freeGarageParking || o.freeStreetParking)
          : null;
        const paid = o
          ? !!(o.paidParkingLot || o.paidGarageParking || o.paidStreetParking)
          : null;
        return {
          placeId,
          name: p.displayName?.text ?? 'Parking',
          address: p.formattedAddress ?? '',
          lat: latN as number,
          lng: lngN as number,
          businessStatus: p.businessStatus,
          parking: { free, paid },
        };
      })
      .filter(Boolean);

    return json({ ok: true, places }, 200);
  } catch (err) {
    return json(
      {
        ok: false,
        error: 'Places fetch failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // ToS: place content/coords are not cacheable by a shared CDN. The client
      // caches in memory per-session only.
      'cache-control': 'no-store',
    },
  });
}
