import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCarResults, sgWallClock, type CarResultInput } from './results';
import type { DbCarparkRaw } from '../../src/lib/api/dbCarparks';

const DEST = { lat: 1.3, lng: 103.85 };

/** A carpark ~`metres` north of DEST, charging `cents` per 30 min all day, every day. */
function row(id: string, metres: number, cents: number): DbCarparkRaw {
  const rate = (day_type: 'WEEKDAY' | 'SAT' | 'SUN_PH') => ({
    day_type,
    start_time: '00:00:00',
    end_time: '23:59:00',
    per_block_cents: cents,
    block_minutes: 30,
    first_hour_cents: null,
    first_block_minutes: null,
    per_entry_cents: null,
    cap_cents: null,
    grace_minutes: 10,
    system: 'ELECTRONIC',
    veh_cat: 'CAR',
    source: 'HDB',
    effective_from: null,
  });
  return {
    id,
    agency: 'HDB',
    source_code: id.split(':')[1],
    name: `Carpark ${id}`,
    address: `Blk ${id}`,
    lat: DEST.lat + metres / 111_000,
    lng: DEST.lng,
    car_park_type: null,
    parking_system: 'ELECTRONIC',
    central_area: false,
    total_lots: 100,
    lot_types: ['C'],
    motorcycle_lots: null,
    heavy_lots: null,
    height_limit_m: 2.1,
    source: 'HDB',
    rate_rows: [rate('WEEKDAY'), rate('SAT'), rate('SUN_PH')],
  } as unknown as DbCarparkRaw;
}

function input(over: Partial<CarResultInput>): CarResultInput {
  return {
    dest: DEST,
    rows: [],
    hdb: null,
    lta: null,
    justpark: null,
    ev: null,
    google: [],
    hours: 2,
    now: new Date(2026, 9, 7, 14, 0), // a Wednesday, 2pm
    limit: 12,
    ...over,
  };
}

test('prices the stay from the rate rows and sorts cheapest first', () => {
  const out = buildCarResults(input({ rows: [row('HDB:A', 100, 120), row('HDB:B', 300, 60)] }));
  assert.deepEqual(out.map((c) => [c.id, c.cost]), [['hdb:b', 2.4], ['hdb:a', 4.8]]);
  assert.equal(out[0].heightLimitM, 2.1);
  assert.ok(out[0].rateLines[0].includes('$0.60 / 30 min'));
});

test('merges live lots and sinks full carparks', () => {
  const hdb = new Map([
    ['B', { lots_available: 0, total_lots: 50, lotTypes: ['C'] }],
    ['A', { lots_available: 12, total_lots: 80, lotTypes: ['C'] }],
  ]) as unknown as CarResultInput['hdb'];
  const out = buildCarResults(input({ rows: [row('HDB:A', 100, 120), row('HDB:B', 300, 60)], hdb }));
  assert.deepEqual(out.map((c) => [c.id, c.lotsAvailable, c.lotsTotal]), [['hdb:a', 12, 80], ['hdb:b', 0, 50]]);
});

test('distance and walk time are from the destination', () => {
  const [c] = buildCarResults(input({ rows: [row('HDB:A', 250, 60)] }));
  assert.ok(Math.abs(c.distanceM - 250) < 5);
  assert.equal(c.walkMin, 3);
});

test('limit caps the list', () => {
  const rows = Array.from({ length: 6 }, (_, i) => row(`HDB:${i}`, 50 * (i + 1), 60));
  assert.equal(buildCarResults(input({ rows, limit: 4 })).length, 4);
});

test('a carpark with no rate rows has no cost and ranks after priced ones', () => {
  const noRates = { ...row('LTA:N', 50, 0), agency: 'LTA', rate_rows: [] } as DbCarparkRaw;
  const out = buildCarResults(input({ rows: [noRates, row('HDB:A', 300, 60)] }));
  assert.deepEqual(
    out.map((c) => [c.id, c.cost]),
    [
      ['hdb:a', 2.4],
      ['lta:n', null],
    ],
  );
  assert.deepEqual(out[1].rateLines, []);
});

test('sgWallClock reads Singapore time whatever the server zone', () => {
  // 06:30 UTC is 14:30 in Singapore.
  const d = sgWallClock(Date.UTC(2026, 9, 7, 6, 30));
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 30);
  assert.equal(d.getDate(), 7);
});
