// Vercel Edge function — Google Places API (New) place details proxy.
//
// Resolves a placeId (from /api/google-places-autocomplete) into the fields
// the app needs to start a carpark search: display name, address, coords.
//
// Passing the same `sessiontoken` that was used during autocomplete finalizes
// the session on Google's side so the whole typeahead → details flow is
// billed as one event rather than per keystroke.
//
// Env vars:
//   GOOGLE_PLACES_API_KEY  required
//
// Query params:
//   place_id       required
//   sessiontoken   optional, must match the autocomplete session
//
// Returns:
//   200 { ok: true, place: { label, address, lat, lng } }
//   400 { ok: false, error }
//   500 { ok: false, error }   missing key
//   502 { ok: false, error }   upstream failure

export const config = { runtime: 'edge' };

const FIELD_MASK = 'id,displayName,formattedAddress,location';

type UpstreamPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const placeId = (url.searchParams.get('place_id') ?? '').trim();
  const sessionToken = url.searchParams.get('sessiontoken') ?? '';

  if (!placeId) {
    return json({ ok: false, error: 'place_id is required' }, 400);
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return json(
      { ok: false, error: 'GOOGLE_PLACES_API_KEY not set on the server' },
      500,
    );
  }

  const upstream = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) upstream.searchParams.set('sessionToken', sessionToken);

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json(
        {
          ok: false,
          error: `Places upstream returned ${res.status}`,
          detail: detail.slice(0, 300),
        },
        502,
      );
    }

    const body = (await res.json()) as UpstreamPlace;
    const lat = body.location?.latitude;
    const lng = body.location?.longitude;
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return json(
        { ok: false, error: 'Place is missing coordinates' },
        502,
      );
    }

    return json(
      {
        ok: true,
        place: {
          label: body.displayName?.text ?? body.formattedAddress ?? 'Destination',
          address: body.formattedAddress ?? '',
          lat,
          lng,
        },
      },
      200,
    );
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
      // Place identity is stable; let the browser keep it briefly.
      'cache-control': 'public, max-age=300, must-revalidate',
    },
  });
}
