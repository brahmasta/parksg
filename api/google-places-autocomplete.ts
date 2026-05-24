// Vercel Edge function — Google Places API (New) autocomplete proxy.
//
// Returns Singapore-scoped place suggestions for an as-you-type query.
// Keeping the API key server-side avoids exposing it in the browser bundle.
//
// Env vars:
//   GOOGLE_PLACES_API_KEY  required, from Google Cloud → Maps Platform credentials.
//                          Enable the "Places API (New)" on the project.
//
// Query params:
//   q              required, the partial text being typed
//   sessiontoken   optional, opaque string from the client; the same token must
//                  be re-used on the subsequent /details call so Google bills
//                  the whole typeahead session as one event
//
// Returns:
//   200 { ok: true, suggestions: [{ placeId, primary, secondary }] }
//   400 { ok: false, error }
//   500 { ok: false, error }   missing key
//   502 { ok: false, error }   upstream failure

export const config = { runtime: 'edge' };

const ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete';

// Singapore bounding box (rough). Restricts suggestions to local POIs.
const SG_RECT = {
  low: { latitude: 1.155, longitude: 103.594 },
  high: { latitude: 1.475, longitude: 104.045 },
};

type UpstreamSuggestion = {
  placePrediction?: {
    placeId?: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    text?: { text?: string };
  };
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const sessionToken = url.searchParams.get('sessiontoken') ?? undefined;

  if (q.length < 2) {
    return json({ ok: true, suggestions: [] }, 200);
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return json(
      { ok: false, error: 'GOOGLE_PLACES_API_KEY not set on the server' },
      500,
    );
  }

  const body: Record<string, unknown> = {
    input: q,
    includedRegionCodes: ['sg'],
    locationRestriction: { rectangle: SG_RECT },
    languageCode: 'en',
  };
  if (sessionToken) body.sessionToken = sessionToken;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify(body),
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

    const upstream = (await res.json()) as { suggestions?: UpstreamSuggestion[] };
    const suggestions = (upstream.suggestions ?? [])
      .map((s) => {
        const p = s.placePrediction;
        if (!p?.placeId) return null;
        const primary =
          p.structuredFormat?.mainText?.text ?? p.text?.text ?? '';
        const secondary = p.structuredFormat?.secondaryText?.text ?? '';
        if (!primary) return null;
        return { placeId: p.placeId, primary, secondary };
      })
      .filter(Boolean);

    return json({ ok: true, suggestions }, 200);
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
      // Autocomplete responses are query-specific; do not cache.
      'cache-control': 'no-store',
    },
  });
}
