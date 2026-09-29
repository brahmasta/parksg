/**
 * URA parking-place capacity ingest.
 *
 * Fills carparks.lot_types / motorcycle_lots / heavy_lots for URA carparks from
 * scripts/data/ura-capacity.json — a trimmed copy of URA's "Capacity of URA
 * Parking Places" GeoJSON on data.gov.sg (PP_CODE, NO_CAR, NO_MCYCLE,
 * NO_H_VEHIC). Without it the app only learns lot types from the live HDB
 * feed, so every URA carpark showed as car-only.
 *
 * Update-only: rows are matched by id "URA:<PP_CODE>" and never created, so
 * parking places we don't carry (mostly motorcycle-only back lanes) are
 * skipped and reported. total_lots is left alone — it already comes from
 * URA's Car_Park_Details feed.
 *
 * To refresh: download the GeoJSON from data.gov.sg, regenerate the JSON
 * (one { ppCode, name, car, motorcycle, heavy, updated } per feature), re-run.
 *
 * Run: npm run ingest:ura-capacity
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
import { toLotTypeUpdate, type UraCapacityEntry } from './lib/ura-capacity';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

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

  const raw = readFileSync(resolve(__dirname, 'data/ura-capacity.json'), 'utf8');
  const entries = JSON.parse(raw) as UraCapacityEntry[];
  process.stderr.write(`Loaded ${entries.length} URA parking places\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  for (const entry of entries) {
    const { id, ...cols } = toLotTypeUpdate(entry);
    const { data, error } = await supabase.from('carparks').update(cols).eq('id', id).select('id');
    if (error) {
      process.stderr.write(`  ${id}: ${error.message}\n`);
      errors += 1;
    } else if (!data || data.length === 0) {
      skipped += 1; // not a carpark we carry
    } else {
      updated += 1;
    }
  }

  console.log('');
  console.log('=== URA capacity ingest ===');
  console.log(`Carparks updated:        ${updated}`);
  console.log(`Not in DB (skipped):     ${skipped}`);
  console.log(`Errors:                  ${errors}`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
