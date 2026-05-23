// OneMap geocoder.
//
// The /common/elastic/search endpoint currently returns full results without
// authentication, though responses include a deprecation warning about
// auth tokens. If OneMap starts enforcing auth in the future, swap this for
// a Vercel serverless function that mints a token from email+password creds
// stored as project env vars (OneMap auth is free).

export type GeocodedPlace = {
  label: string;
  address: string;
  postal: string;
  lat: number;
  lng: number;
};

const BASE = 'https://www.onemap.gov.sg/api/common/elastic/search';

type RawResult = {
  SEARCHVAL: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
};

export async function geocode(query: string): Promise<GeocodedPlace | null> {
  const url = new URL(BASE);
  url.searchParams.set('searchVal', query.trim());
  url.searchParams.set('returnGeom', 'Y');
  url.searchParams.set('getAddrDetails', 'Y');
  url.searchParams.set('pageNum', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`OneMap search failed: ${res.status}`);
  const body = (await res.json()) as { results?: RawResult[] };
  const first = body.results?.[0];
  if (!first) return null;

  const lat = parseFloat(first.LATITUDE);
  const lng = parseFloat(first.LONGITUDE);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Prefer the building name if it's not "NIL", otherwise the address.
  const label =
    first.BUILDING && first.BUILDING !== 'NIL' ? properCase(first.BUILDING) : query.trim();

  return {
    label,
    address: properCase(first.ADDRESS),
    postal: first.POSTAL,
    lat,
    lng,
  };
}

const ALL_CAPS = /\b(HDB|URA|LTA|MSCP|MRT|SMRT|CBD|JEM|VIP|PIE|BKE|TPE|KPE|ECP|NSE|AYE|CTE|ICA|SAFRA|NTUC|NUS|NTU|SMU|SIM)\b/gi;

function properCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .replace(ALL_CAPS, (m) => m.toUpperCase());
}
