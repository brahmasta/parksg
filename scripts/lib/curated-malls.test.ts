import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE_TO_CARPARK_ID } from '../../src/lib/server/justpark';

/**
 * Guards for scripts/data/curated-malls.json, the hand-verified rate cards that
 * `npm run migrate:malls` writes as source='MANUAL'. A typo here ships a
 * carpark to the wrong side of the island or a $0 price, so check the shape
 * before it reaches the DB.
 */

type Rate = {
  dayType: string;
  start?: string | null;
  end?: string | null;
  firstHourCents?: number | null;
  firstBlockMinutes?: number | null;
  perBlockCents?: number | null;
  blockMinutes?: number | null;
  perEntryCents?: number | null;
  capCents?: number | null;
  graceMinutes?: number | null;
};
type Entry = {
  id?: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  ratesOnly?: boolean;
  totalLots?: number | null;
  provenance?: { url?: string; verified?: string };
  rates: Rate[];
};

const entries = JSON.parse(
  readFileSync(resolve(__dirname, '../data/curated-malls.json'), 'utf8'),
) as Entry[];

// Mainland Singapore + Sentosa, generously padded.
const inSingapore = (lat: number, lng: number) =>
  lat > 1.2 && lat < 1.48 && lng > 103.6 && lng < 104.05;
const HHMM = /^([01]\d|2[0-4]):[0-5]\d$/;

describe('curated-malls.json', () => {
  it('has unique ids', () => {
    const ids = entries.map((e) => e.id ?? e.name);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('gives every carpark it creates coordinates inside Singapore', () => {
    for (const e of entries.filter((x) => !x.ratesOnly)) {
      assert.ok(
        typeof e.lat === 'number' && typeof e.lng === 'number' && inSingapore(e.lat, e.lng),
        `${e.name}: lat/lng ${e.lat},${e.lng}`,
      );
    }
  });

  it('records where and when each rate card was verified', () => {
    for (const e of entries) {
      assert.ok(e.provenance?.url, `${e.name}: provenance.url`);
      assert.match(e.provenance?.verified ?? '', /^\d{4}-\d{2}/, `${e.name}: provenance.verified`);
    }
  });

  it('prices every rate row (a per-block pair or a per-entry charge)', () => {
    for (const e of entries) {
      assert.ok(e.rates.length > 0, `${e.name}: no rates`);
      for (const r of e.rates) {
        const label = `${e.name} ${r.dayType} ${r.start ?? ''}-${r.end ?? ''}`;
        assert.ok(['WEEKDAY', 'SAT', 'SUN_PH'].includes(r.dayType), `${label}: dayType`);
        if (r.start != null) assert.match(r.start, HHMM, `${label}: start`);
        if (r.end != null) assert.match(r.end, HHMM, `${label}: end`);
        const perBlock = (r.perBlockCents ?? 0) > 0 && (r.blockMinutes ?? 0) > 0;
        const perEntry = r.perEntryCents != null && r.perEntryCents >= 0;
        assert.ok(perBlock || perEntry, `${label}: needs perBlockCents+blockMinutes or perEntryCents`);
      }
    }
  });

  it('only sets firstBlockMinutes as a positive tier length on a first-hour row', () => {
    for (const e of entries) {
      for (const r of e.rates) {
        if (r.firstBlockMinutes == null) continue;
        const label = `${e.name} ${r.dayType} ${r.start ?? ''}-${r.end ?? ''}`;
        assert.ok(r.firstBlockMinutes > 0, `${label}: firstBlockMinutes must be > 0`);
        assert.ok(r.firstHourCents != null, `${label}: firstBlockMinutes without firstHourCents`);
      }
    }
  });

  it('covers all three day types for every carpark', () => {
    for (const e of entries) {
      const days = new Set(e.rates.map((r) => r.dayType));
      for (const d of ['WEEKDAY', 'SAT', 'SUN_PH']) assert.ok(days.has(d), `${e.name}: missing ${d}`);
    }
  });

  it('only maps JustPark live lots onto curated carparks', () => {
    const curated = new Set(entries.map((e) => e.id));
    for (const [code, id] of Object.entries(SITE_TO_CARPARK_ID)) {
      assert.ok(curated.has(id), `JustPark ${code} → ${id} has no curated-malls.json entry`);
    }
  });
});
