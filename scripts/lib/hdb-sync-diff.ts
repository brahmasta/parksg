/**
 * What an HDB sync would change, worked out without writing anything:
 * `npm run sync:hdb:dry`. Compares the data.gov.sg HDB Carpark Information
 * records with the HDB rows already in the database.
 *
 * Only fields that reach the app are compared: the address (also the name),
 * the carpark type, the payment system, and the three fields the rate rule
 * engine reads (free, night and short-term parking), since a change in any of
 * those changes the prices shown.
 */

export type HdbUpstreamRecord = {
  car_park_no?: string;
  address?: string;
  car_park_type?: string;
  type_of_parking_system?: string;
  free_parking?: string;
  night_parking?: string;
  short_term_parking?: string;
};

export type HdbDbRow = {
  source_code: string;
  address: string | null;
  car_park_type: string | null;
  parking_system: string | null;
  /** The upstream record stored at the last sync. */
  raw: Record<string, unknown> | null;
};

export type HdbChange = { code: string; fields: string[] };

export type HdbDiff = {
  /** In the source, not in the database: new carparks. */
  added: string[];
  /** In the database, no longer in the source: likely closed. A sync never
   *  deletes these; they need a decision by hand. */
  removed: string[];
  changed: HdbChange[];
  unchanged: number;
};

const RATE_FIELDS = ['free_parking', 'night_parking', 'short_term_parking'] as const;

function system(s: string | undefined | null): string {
  return (s ?? '').toUpperCase().includes('COUPON') ? 'COUPON' : 'EPS';
}

const norm = (v: unknown): string => String(v ?? '').trim().toUpperCase();

export function diffHdb(upstream: HdbUpstreamRecord[], db: HdbDbRow[]): HdbDiff {
  const dbByCode = new Map(db.map((r) => [r.source_code, r]));
  const seen = new Set<string>();
  const diff: HdbDiff = { added: [], removed: [], changed: [], unchanged: 0 };

  for (const rec of upstream) {
    const code = (rec.car_park_no ?? '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const row = dbByCode.get(code);
    if (!row) {
      diff.added.push(code);
      continue;
    }
    const fields: string[] = [];
    if (norm(rec.address) !== norm(row.address)) fields.push('address');
    if (norm(rec.car_park_type) !== norm(row.car_park_type)) fields.push('car_park_type');
    if (system(rec.type_of_parking_system) !== system(row.parking_system)) {
      fields.push(`parking_system ${system(row.parking_system)}→${system(rec.type_of_parking_system)}`);
    }
    for (const f of RATE_FIELDS) {
      // No stored record to compare against: say nothing rather than guess.
      if (row.raw && norm(rec[f]) !== norm(row.raw[f])) fields.push(f);
    }
    if (fields.length > 0) diff.changed.push({ code, fields });
    else diff.unchanged += 1;
  }

  for (const row of db) if (!seen.has(row.source_code)) diff.removed.push(row.source_code);

  diff.added.sort();
  diff.removed.sort();
  diff.changed.sort((a, b) => a.code.localeCompare(b.code));
  return diff;
}

/** Plain-text report for the terminal. */
export function formatHdbDiff(diff: HdbDiff): string {
  const lines = [
    '=== HDB sync, dry run (nothing written) ===',
    `New in source:      ${diff.added.length}${diff.added.length ? `  ${diff.added.join(', ')}` : ''}`,
    `Gone from source:   ${diff.removed.length}${diff.removed.length ? `  ${diff.removed.join(', ')}` : ''}`,
    `Changed:            ${diff.changed.length}`,
    ...diff.changed.map((c) => `  ${c.code}: ${c.fields.join(', ')}`),
    `Unchanged:          ${diff.unchanged}`,
  ];
  if (diff.removed.length) {
    lines.push('', 'Carparks gone from the source are NOT deleted by a sync. Check each one and remove it by hand if it has closed.');
  }
  return lines.join('\n');
}
