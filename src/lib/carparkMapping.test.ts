import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUraRatesIndex, dbRowToCarpark } from './carparkMapping';
import { applyUraRates } from './uraJoin';
import { pickCheapestId, selectResultsView } from './resultsView';
import { estCostForStay } from './stay';
import { formatCostMaybe } from './availability';
import { resultsQuality } from './resultsQuality';
import type { Carpark } from './types';
import type { DbAgency, DbCarparkRaw, DbRateRowRaw, DbSource } from './api/dbCarparks';

const DEST = { lat: 1.3, lng: 103.85 };
const NOW = new Date(2026, 9, 7, 14, 0); // a Wednesday, 2pm

/** `cents` per 30 min all day, every day. */
function rateRows(cents: number, source: DbSource = 'HDB'): DbRateRowRaw[] {
  return (['WEEKDAY', 'SAT', 'SUN_PH'] as const).map((day_type) => ({
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
    system: 'EPS',
    veh_cat: 'CAR',
    source,
    effective_from: null,
  }));
}

function row(id: string, agency: DbAgency, rate_rows: DbRateRowRaw[], metres = 100): DbCarparkRaw {
  return {
    id,
    agency,
    source_code: id.split(':')[1],
    name: `Carpark ${id}`,
    address: null,
    lat: DEST.lat + metres / 111_000,
    lng: DEST.lng,
    car_park_type: null,
    parking_system: 'EPS',
    central_area: false,
    total_lots: 100,
    lot_types: null,
    motorcycle_lots: null,
    heavy_lots: null,
    height_limit_m: null,
    source: 'MANUAL',
    rate_rows,
  };
}

const map = (r: DbCarparkRaw) => dbRowToCarpark(r, DEST, new Map(), 'WEEKDAY', 14);
const stayCost = (cp: Carpark, hours: number) =>
  estCostForStay(cp, { startMode: 'later', startAt: NOW, hours });

test('a carpark with rate rows is priced from them', () => {
  const cp = map(row('HDB:A', 'HDB', rateRows(60)));
  assert.equal(cp.rateUnknown, undefined);
  assert.equal(cp.rateMissing, undefined);
  assert.equal(cp.estByHours[1], 1.2);
  assert.equal(cp.rates.weekday.length, 1);
});

for (const agency of ['LTA', 'URA', 'OPERATOR', 'JTC'] as const) {
  test(`${agency} carpark with no rate rows is "Rate unknown", not an operator default`, () => {
    const cp = map(row(`${agency}:X`, agency, []));
    assert.equal(cp.rateUnknown, true);
    assert.equal(cp.rateMissing, true);
    // No placeholder schedule (the old "≈ $1.60 / 30 min" / "$1.20 / 30 min" rows).
    assert.deepEqual(cp.rates, { weekday: [], saturday: [], sundayPH: [] });
    assert.equal(formatCostMaybe(cp, cp.estByHours[1]), '—');
    assert.equal(stayCost(cp, 2), null);
  });
}

test('JTC metadata-only carpark still maps with its location and lots', () => {
  const cp = map(row('JTC:J1', 'JTC', []));
  assert.equal(cp.id, 'jtc:j1');
  assert.equal(cp.lotsTotal, 100);
  assert.ok(cp.walkMeters > 0);
});

test('parser-stub rows (0 / 0 min) count as no rate', () => {
  const stubs = rateRows(0, 'LTA_DATAGOV').map((r) => ({ ...r, block_minutes: 0 }));
  const cp = map(row('LTA:S', 'LTA', stubs));
  assert.equal(cp.rateUnknown, true);
  assert.deepEqual(cp.rates, { weekday: [], saturday: [], sundayPH: [] });
});

test('rate-unknown carparks never take the cheapest badge or the top cost rank', () => {
  const unknown = map(row('LTA:U', 'LTA', [], 50));
  const priced = map(row('HDB:P', 'HDB', rateRows(120), 400));
  const carparks = [unknown, priced];

  assert.equal(pickCheapestId(carparks, 1), 'hdb:p');
  assert.equal(pickCheapestId(carparks, 1, (c) => stayCost(c, 1)), 'hdb:p');
  assert.equal(pickCheapestId([unknown], 1), null);

  const { ranked } = selectResultsView({
    carparks,
    state: 'loaded',
    availableOnly: false,
    evOnly: false,
    sortBy: 'cost',
  });
  assert.deepEqual(
    ranked.map((c) => c.id),
    ['hdb:p', 'lta:u'],
  );
});

test('URA join clears "Rate unknown" when it can price the carpark', () => {
  // Map a rateless copy (as if the mapper couldn't price it), then join the
  // URA rows the index is built from.
  const withRates = row('URA:Q1', 'URA', rateRows(120, 'URA'));
  const cp = map({ ...withRates, rate_rows: [] });
  assert.equal(cp.rateUnknown, true);
  const [joined] = applyUraRates([cp], buildUraRatesIndex([withRates]), NOW).carparks;
  assert.ok(!joined.rateUnknown);
  assert.ok(!joined.rateMissing);
  assert.equal(joined.estByHours[1], 2.4);
});

test('results quality counts our rate gaps apart from Google results', () => {
  const gap = map(row('LTA:G', 'LTA', []));
  const priced = map(row('HDB:P', 'HDB', rateRows(60)));
  const google: Carpark = { ...gap, id: 'google:x', rateMissing: undefined, source: 'GOOGLE' };
  assert.deepEqual(resultsQuality([gap, priced, google]), {
    count: 3,
    priced: 1,
    estimated: 1,
    unknown: 1,
  });
});
