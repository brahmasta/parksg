/**
 * One-off geocoding helper for curated malls.
 *
 * Looks up WGS84 coordinates (and OneMap's canonical address) for mall names via
 * the OneMap search API, so they can be baked into scripts/data/curated-malls.json.
 * The ingest step (migrate-curated-malls.ts) stays deterministic and does NOT
 * call OneMap — coordinates live in the JSON.
 *
 * Usage:
 *   tsx scripts/geocode-malls.ts "VivoCity" "ION Orchard" "Jewel Changi Airport"
 *   tsx scripts/geocode-malls.ts --missing   # geocode entries in the JSON that
 *                                             # have lat/lng of 0 or null
 *
 * Env (.env.local): ONEMAP_EMAIL, ONEMAP_PASSWORD (optional — search works
 * unauthenticated but is rate-limited; a token raises the limit).
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const ONEMAP_BASE = 'https://www.onemap.gov.sg';

async function mintToken(): Promise<string | null> {
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) return null;
  try {
    const res = await fetch(`${ONEMAP_BASE}/api/auth/post/getToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      process.stderr.write(`  OneMap token: HTTP ${res.status} (continuing unauthenticated)\n`);
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (err) {
    process.stderr.write(`  OneMap token failed: ${err instanceof Error ? err.message : err}\n`);
    return null;
  }
}

type SearchResult = {
  SEARCHVAL: string;
  ADDRESS: string;
  LATITUDE: string;
  LONGITUDE: string;
};

async function search(
  query: string,
  token: string | null,
): Promise<SearchResult[]> {
  const url =
    `${ONEMAP_BASE}/api/common/elastic/search` +
    `?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const res = await fetch(url, {
    headers: token ? { Authorization: token } : {},
  });
  if (!res.ok) {
    process.stderr.write(`  search "${query}": HTTP ${res.status}\n`);
    return [];
  }
  const json = (await res.json()) as { results?: SearchResult[] };
  return json.results ?? [];
}

function namesFromJson(): string[] {
  const raw = readFileSync(resolve(__dirname, 'data/curated-malls.json'), 'utf8');
  const entries = JSON.parse(raw) as Array<{
    name: string;
    lat?: number | null;
    lng?: number | null;
  }>;
  return entries
    .filter((e) => !e.lat || !e.lng) // 0, null, undefined → needs geocoding
    .map((e) => e.name);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const names = args.includes('--missing')
    ? namesFromJson()
    : args.filter((a) => !a.startsWith('--'));

  if (names.length === 0) {
    console.error('Nothing to geocode. Pass mall names or --missing.');
    process.exit(1);
  }

  const token = await mintToken();
  process.stderr.write(token ? 'Using OneMap token.\n' : 'Unauthenticated OneMap search.\n');

  for (const name of names) {
    const results = await search(name, token);
    if (results.length === 0) {
      console.log(`${name}\t<no result>`);
      continue;
    }
    const top = results[0];
    const lat = Number(top.LATITUDE).toFixed(6);
    const lng = Number(top.LONGITUDE).toFixed(6);
    console.log(`${name}\t${lat}\t${lng}\t${top.ADDRESS}`);
    // Light politeness delay to stay under OneMap's anonymous rate limit.
    await new Promise((r) => setTimeout(r, 250));
  }
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
