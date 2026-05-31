// CapitaLand JustPark live lot-availability scraper.
//
// CapitaLand's malls (Bedok Mall, Plaza Singapura, Funan, …) publish real-time
// lot counts at https://justpark.capitaland.com/Lot-Availability. There is no
// open API; the page is an ASP.NET MVC + Vue app that tunnels every data call
// through a single generic proxy:
//
//   POST /AjaxNoAuth/OnHttpPost
//     headers:
//       __RequestVerificationToken: <token from the page's hidden form field>
//       X-APIAction:                SelectSiteNoAuth/OnSelectSite   (real target)
//       x-ModID:                    FELotAvail
//     body (multipart/form-data):
//       JData = '{"DisplayType":"LotAvail","LotType":null}'
//
// The antiforgery handshake needs a real session: GET the page first to obtain
// the cookies (__RequestVerificationToken HttpOnly + Azure ARRAffinity) AND the
// hidden form token, then replay both on the POST. Posting straight to
// /SelectSiteNoAuth/OnSelectSite without the proxy 302s to /Error.
//
// Response shape:
//   { "HasError": false, "Message": "", "Result": "<stringified JSON array>" }
// each Result element: { SiteCode, SiteDesc, BusinessUnitDesc, LotBalance,
//                        LotTotal, Available, IsFull, … }
//
// This module is split so the *parsing* (pure, deterministic) is unit-testable
// against a captured fixture, while the *fetch* (network, antiforgery dance) is
// isolated and exercised only at runtime.

const BASE = 'https://justpark.capitaland.com';
const PAGE_URL = `${BASE}/Lot-Availability`;
const PROXY_URL = `${BASE}/AjaxNoAuth/OnHttpPost`;
const API_ACTION = 'SelectSiteNoAuth/OnSelectSite';
const MOD_ID = 'FELotAvail';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** One CapitaLand site as the live feed reports it. */
export type JustParkSite = {
  siteCode: string;
  name: string;
  businessUnit: string;
  /** Free lots right now. null when the feed omits/garbles the figure. */
  lotsAvailable: number | null;
  /** Total capacity per the feed. null when omitted. */
  lotsTotal: number | null;
  isFull: boolean;
};

/**
 * Map a JustPark SiteCode → our DB carpark id. Only the malls we have curated
 * (and that therefore exist in `carparks`) are listed; live counts for any
 * other site have nowhere to attach and are dropped by the merge.
 *
 * Clarke Quay (CQ) and Sengkang Grand Mall (SGM) appear in the feed but are not
 * yet curated in the DB — add them here once they have carpark rows.
 */
export const SITE_TO_CARPARK_ID: Record<string, string> = {
  BM: 'LTA:65', // Bedok Mall
  'B+': 'LTA:61', // Bugis+
  FN: 'LTA:66', // Funan
  IMM: 'LTA:53', // IMM Building
  J8: 'LTA:64', // Junction 8
  LO: 'LTA:62', // Lot One Shoppers' Mall
  PS: 'LTA:9', // Plaza Singapura
  RCS: 'LTA:3', // Raffles City Shopping Centre
  TM: 'LTA:63', // Tampines Mall
  TAO: 'LTA:57', // The Atrium@Orchard
  WGR: 'LTA:43', // Westgate - Retail
};

type RawSite = {
  SiteCode?: unknown;
  SiteDesc?: unknown;
  BusinessUnitDesc?: unknown;
  LotBalance?: unknown;
  LotTotal?: unknown;
  IsFull?: unknown;
};

/**
 * Parse the proxy response body into normalized sites. Accepts either the raw
 * response text or the already-parsed envelope object. Throws if the upstream
 * flagged an error; returns [] for an empty/garbled Result rather than throwing
 * so a transient blip degrades to "no live data" instead of a 500.
 */
export function parseJustParkResponse(input: string | object): JustParkSite[] {
  const envelope = (typeof input === 'string' ? safeJson(input) : input) as
    | { HasError?: unknown; Message?: unknown; Result?: unknown }
    | null;
  if (!envelope || typeof envelope !== 'object') return [];
  if (envelope.HasError === true) {
    const msg = typeof envelope.Message === 'string' ? envelope.Message : 'unknown error';
    throw new Error(`JustPark upstream error: ${msg}`);
  }
  // Result is a stringified JSON array (double-encoded).
  const result =
    typeof envelope.Result === 'string' ? safeJson(envelope.Result) : envelope.Result;
  if (!Array.isArray(result)) return [];
  const out: JustParkSite[] = [];
  for (const r of result as RawSite[]) {
    const siteCode = str(r.SiteCode);
    if (!siteCode) continue;
    out.push({
      siteCode,
      name: str(r.SiteDesc) ?? siteCode,
      businessUnit: str(r.BusinessUnitDesc) ?? '',
      lotsAvailable: int(r.LotBalance),
      lotsTotal: int(r.LotTotal),
      isFull: r.IsFull === true,
    });
  }
  return out;
}

/** Live lot figures keyed by our DB carpark id, ready for the availability merge. */
export type JustParkLots = { id: string; lotsAvailable: number | null; lotsTotal: number | null };

/** Project parsed sites onto DB carpark ids via SITE_TO_CARPARK_ID. */
export function toCarparkLots(sites: JustParkSite[]): JustParkLots[] {
  const out: JustParkLots[] = [];
  for (const s of sites) {
    const id = SITE_TO_CARPARK_ID[s.siteCode];
    if (!id) continue;
    out.push({ id, lotsAvailable: s.lotsAvailable, lotsTotal: s.lotsTotal });
  }
  return out;
}

/**
 * Perform the full antiforgery handshake and return the live sites.
 * Network + DOM-token dependent; not unit tested (see parseJustParkResponse).
 */
export async function fetchJustParkLive(): Promise<JustParkSite[]> {
  // 1. GET the page → session cookies + hidden antiforgery form token.
  const pageRes = await fetch(PAGE_URL, {
    headers: { 'user-agent': UA, accept: 'text/html' },
  });
  if (!pageRes.ok) {
    throw new Error(`JustPark page GET returned ${pageRes.status}`);
  }
  const cookies = collectCookies(pageRes);
  const html = await pageRes.text();
  const token = extractFormToken(html);
  if (!token) throw new Error('JustPark antiforgery form token not found on page');
  if (!cookies) throw new Error('JustPark session cookies not set on page GET');

  // 2. POST the generic proxy with token + cookies + the real target action.
  const form = new FormData();
  form.append('JData', JSON.stringify({ DisplayType: 'LotAvail', LotType: null }));
  const postRes = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'user-agent': UA,
      cookie: cookies,
      __RequestVerificationToken: token,
      'X-APIAction': API_ACTION,
      'x-ModID': MOD_ID,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: PAGE_URL,
      Origin: BASE,
    },
    body: form,
  });
  if (!postRes.ok) {
    throw new Error(`JustPark proxy POST returned ${postRes.status}`);
  }
  const text = await postRes.text();
  return parseJustParkResponse(text);
}

// ---- helpers ----------------------------------------------------------------

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  return null;
}

function int(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** Join all Set-Cookie name=value pairs from a response into a Cookie header. */
function collectCookies(res: Response): string {
  // Node 18+/undici exposes getSetCookie(); fall back to the merged header.
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (res.headers.get('set-cookie') ?? '').split(/,(?=\s*[^;,\s]+=)/);
  const pairs: string[] = [];
  for (const line of raw) {
    const first = line.split(';', 1)[0]?.trim();
    if (first && first.includes('=')) pairs.push(first);
  }
  return pairs.join('; ');
}

/** Pull the hidden __RequestVerificationToken value out of the page HTML. */
function extractFormToken(html: string): string | null {
  const m = html.match(
    /name="__RequestVerificationToken"[^>]*value="([^"]+)"|value="([^"]+)"[^>]*name="__RequestVerificationToken"/,
  );
  return m ? (m[1] ?? m[2] ?? null) : null;
}
