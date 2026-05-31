/**
 * Daily URA rate ingest — the URA analogue of scripts/ingest-lta-rates.ts.
 *
 * Mints a fresh URA Data Service token, pulls Car_Park_Details, parses the
 * rate bands (src/lib/ura.ts) and writes them to the Supabase `rate_rows`
 * table with source 'URA'. The actual work lives in the shared
 * src/lib/server/uraIngest.ts module so the Vercel cron handler
 * (api/cron/ura-rates-ingest.ts) runs the exact same logic.
 *
 * Run:
 *   npx tsx scripts/ingest-ura-rates.ts
 *   npm run ingest:ura-rates
 *
 * Env (read from .env.local in the project root):
 *   SUPABASE_URL              required
 *   SUPABASE_SERVICE_ROLE_KEY required
 *   URA_ACCESS_KEY            required
 */

import 'dotenv/config';
import { resolve } from 'path';
import dotenv from 'dotenv';

import { ingestUraRates } from '../src/lib/server/uraIngest';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessKey = process.env.URA_ACCESS_KEY;

  const missing = [
    !supabaseUrl && 'SUPABASE_URL',
    !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !accessKey && 'URA_ACCESS_KEY',
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`ERROR: missing env var(s) in .env.local: ${missing.join(', ')}`);
    process.exit(1);
  }

  const result = await ingestUraRates({
    supabaseUrl: supabaseUrl!,
    serviceRoleKey: serviceRoleKey!,
    accessKey: accessKey!,
    log: (msg) => process.stderr.write(`${msg}\n`),
  });

  console.log('');
  console.log('=== URA Rates Ingest ===');
  console.log(`Carparks with rates: ${result.carparks}`);
  console.log(`Rate rows written:   ${result.upserted}`);
  console.log(`Skipped / errors:    ${result.errors}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFAILED: ${msg}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
