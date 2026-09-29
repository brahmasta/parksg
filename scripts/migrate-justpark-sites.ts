/**
 * CapitaLand JustPark site ingest.
 *
 * Upserts a coordinates-only carpark row for every CapitaLand site in the
 * JustPark live feed that has no curated rate card yet (CBD towers such as
 * CapitaSky / Asia Square Tower 2, and the business parks). Each row's id is
 * listed in SITE_TO_CARPARK_ID (src/lib/server/justpark.ts), so the site gets
 * CapitaLand's live lot count on the next fetch — shown without a price until
 * someone curates a rate card.
 *
 * Coordinates are OneMap building points from the Open-Data-Licensed postal
 * dump (https://github.com/xkjyeah/singapore-postal-codes), baked into
 * scripts/data/justpark-sites.json so this step stays deterministic.
 *
 * Metadata only, like the JTC ingest: rate_rows are never touched, so a rate
 * card added later (via curated-malls.json with the same id, or the admin UI)
 * survives re-runs. Tagged source='MANUAL' so the full sync leaves it alone.
 *
 * Run: npm run migrate:justpark
 *
 * Env (read from .env.local):
 *   SUPABASE_URL              required
 *   SUPABASE_SERVICE_ROLE_KEY required
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

type JustParkSiteEntry = {
  code: string;
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  totalLots: number | null;
  businessUnit: string;
};

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const raw = readFileSync(resolve(__dirname, 'data/justpark-sites.json'), 'utf8');
  const entries = JSON.parse(raw) as JustParkSiteEntry[];
  process.stderr.write(`Loaded ${entries.length} JustPark sites\n`);

  const today = new Date().toISOString();
  const carparks = entries.map((e) => ({
    id: e.id,
    agency: 'OPERATOR',
    source_code: e.code,
    name: e.name,
    address: e.address,
    lat: e.lat,
    lng: e.lng,
    car_park_type: e.businessUnit === 'Commercial' ? 'COMMERCIAL' : 'BUSINESS_PARK',
    parking_system: 'EPS',
    central_area: false,
    total_lots: e.totalLots,
    source: 'MANUAL',
    last_synced: today,
    raw: { justpark: true, operator: 'CapitaLand', siteCode: e.code, businessUnit: e.businessUnit },
  }));

  const { error } = await supabase.from('carparks').upsert(carparks, { onConflict: 'id' });
  if (error) {
    console.error(`FAILED: upsert carparks: ${error.message}`);
    process.exit(1);
  }

  console.log('');
  console.log('=== JustPark sites ingest ===');
  console.log(`Carparks upserted: ${carparks.length}`);
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
