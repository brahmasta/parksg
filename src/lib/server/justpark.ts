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
 * Map a JustPark SiteCode → our DB carpark id(s). Every site in the feed that
 * publishes a live count is mapped, so CapitaLand's numbers always win:
 *
 *   - sites already curated in scripts/data/curated-malls.json (with a rate
 *     card) map onto that row;
 *   - the rest map onto a coordinates-only row from
 *     scripts/data/justpark-sites.json (`npm run migrate:justpark`), which shows
 *     live lots but no price until someone curates a rate card.
 *
 * A code may map to several ids when one carpark serves several buildings
 * (e.g. 3C → The Chadwick / The Curie / The Cavendish).
 *
 * Deliberately unmapped: the 22 sites the feed reports as LotBalance "NA"
 * (Westgate - Office, Cintech II–IV, the Galaxis sub-sites, KA Place,
 * The Gemini and all 13 VPC logistics sites) — CapitaLand publishes no count
 * for them, so there is nothing live to show.
 */
export const SITE_TO_CARPARK_ID: Record<string, string | readonly string[]> = {
  BM: 'LTA:65', // Bedok Mall
  'B+': 'LTA:61', // Bugis+
  CQ: 'LTA:59', // Clarke Quay (DataMall's "CQ @ Clarke Quay")
  FN: 'LTA:66', // Funan
  IMM: 'LTA:53', // IMM Building
  J8: 'LTA:64', // Junction 8
  LO: 'LTA:62', // Lot One Shoppers' Mall
  PS: 'LTA:9', // Plaza Singapura
  RCS: 'LTA:3', // Raffles City Shopping Centre
  TM: 'LTA:63', // Tampines Mall
  TAO: 'LTA:57', // The Atrium@Orchard
  WGR: 'LTA:43', // Westgate - Retail
  // CBD commercial towers — the 2018 LTA_DATAGOV rows, curated with coords.
  SBR: 'LTA:six_battery_road', // Six Battery Road
  CT: 'LTA:capital_tower', // Capital Tower
  // Already curated (curated-malls.json) — rates + live lots.
  SGM: 'OPERATOR:sengkang_grand_mall', // Sengkang Grand Mall
  CG: 'OPERATOR:capitagreen', // CapitaGreen
  CS: 'LTA:golden_shoe_complex', // CapitaSpring (built on the Golden Shoe site)
  CRE: 'OPERATOR:31_international_business_park', // 31 IBP - Creative Building
  KEND: 'OPERATOR:the_kendall', // The Kendall
  APR: 'OPERATOR:aperia', // Aperia
  ASCT: 'OPERATOR:ascent', // Ascent
  CT1: 'OPERATOR:cintech_i', // Cintech I
  GALB: 'OPERATOR:galaxis', // Galaxis
  RC: 'OPERATOR:rochester_commons', // Rochester Commons
  TECP: 'OPERATOR:techpoint', // Techpoint
  TPPL: 'OPERATOR:teletech_park', // TeleTech Park
  ALP: 'OPERATOR:the_alpha', // The Alpha
  ARI: 'OPERATOR:the_aries', // The Aries
  CAP: 'OPERATOR:the_capricorn', // The Capricorn
  '3C': ['OPERATOR:the_chadwick', 'OPERATOR:the_curie', 'OPERATOR:the_cavendish'],
  GALN: 'OPERATOR:the_galen_singapore_science_park_ii', // The Galen
  UBIX: 'OPERATOR:ubix', // UBIX
  // Coordinates-only rows (justpark-sites.json) — live lots, no rates yet.
  '21CQ': 'OPERATOR:capitaland_21_collyer_quay', // 21 Collyer Quay
  AST2: 'OPERATOR:capitaland_asia_square_tower_2', // Asia Square Tower 2
  '79RR': 'OPERATOR:capitaland_capitasky', // CapitaSky
  '1CBP': 'OPERATOR:capitaland_1_changi_business_park_avenue_1', // 1 Changi Business Park Avenue 1
  PLZ8: 'OPERATOR:capitaland_plaza_8_cbp', // Plaza 8 @ CBP
  '1JKG': 'OPERATOR:capitaland_1_jalan_kilang', // 1 Jalan Kilang
  '5SPD': 'OPERATOR:capitaland_1_5_7_science_park_drive', // 1, 5, 7 Science Park Drive
  '138D': 'OPERATOR:capitaland_138_depot_road', // 138 Depot Road
  '3CBC': 'OPERATOR:capitaland_3_and_5_changi_business_park_crescent', // 3 & 5 Changi Business Park Crescent
  '3CBV': 'OPERATOR:capitaland_3_changi_business_park_vista', // 3 Changi Business Park Vista
  '3TSD': 'OPERATOR:capitaland_3_tai_seng_drive', // 3 Tai Seng Drive
  '5TSD': 'OPERATOR:capitaland_steel_industries_building_5_tai_seng_drive', // Steel Industries Building (5 Tai Seng Drive)
  '53SN': 'OPERATOR:capitaland_53_serangoon_north_avenue_4', // 53 Serangoon North Avenue 4
  '622T': 'OPERATOR:capitaland_622_lorong_1_toa_payoh', // 622 Lorong 1 Toa Payoh
  '80BD': 'OPERATOR:capitaland_80_bendemeer_road', // 80 Bendemeer Road
  ACER: 'OPERATOR:capitaland_acer_building', // Acer Building
  CLOG: 'OPERATOR:capitaland_changi_logistics_centre', // Changi Logistics Centre
  CORP: 'OPERATOR:capitaland_corporation_place', // Corporation Place
  FDAX: 'OPERATOR:capitaland_foodaxis_senoko', // FoodAxis @ Senoko
  HANS: 'OPERATOR:capitaland_hansapoint_cbp', // HansaPoint @ CBP
  '17CB': 'OPERATOR:capitaland_honeywell_building', // Honeywell Building
  ICON: 'OPERATOR:capitaland_icon_ibp', // Icon @ IBP
  INF: 'OPERATOR:capitaland_infinite_studios', // Infinite Studios
  KAC: 'OPERATOR:capitaland_ka_centre', // KA Centre
  NEUR: 'OPERATOR:capitaland_neuros_and_immunos', // Neuros & Immunos
  NEXU: 'OPERATOR:capitaland_nexus_one_north', // Nexus @ one-north
  NORD: 'OPERATOR:capitaland_nordic_european_centre', // Nordic European Centre
  NUC: 'OPERATOR:capitaland_nucleos', // Nucleos
  RUTH: 'OPERATOR:capitaland_oasis_and_rutherford', // Oasis & Rutherford
  PTC: 'OPERATOR:capitaland_pacific_tech_centre', // Pacific Tech Centre
  BIZH: 'OPERATOR:capitaland_tampines_biz_hub', // Tampines Biz-Hub
  TECL: 'OPERATOR:capitaland_techlink', // Techlink
  TPL1: 'OPERATOR:capitaland_techplace_i', // Techplace I
  TPL2: 'OPERATOR:capitaland_techplace_ii', // Techplace II
  TECQ: 'OPERATOR:capitaland_techquest', // Techquest
  TECV: 'OPERATOR:capitaland_techview', // Techview
  SC: 'OPERATOR:capitaland_the_siemens_centre', // The Siemens Centre
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
    const mapped = SITE_TO_CARPARK_ID[s.siteCode];
    if (!mapped) continue;
    const ids = typeof mapped === 'string' ? [mapped] : mapped;
    for (const id of ids) out.push({ id, lotsAvailable: s.lotsAvailable, lotsTotal: s.lotsTotal });
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
