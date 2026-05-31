import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseJustParkResponse,
  toCarparkLots,
  SITE_TO_CARPARK_ID,
  type JustParkSite,
} from './justpark.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../../../scripts/data/justpark-sample.json');
const fixtureRaw = readFileSync(fixturePath, 'utf8');

test('parses the captured live response into sites', () => {
  const sites = parseJustParkResponse(fixtureRaw);
  assert.ok(sites.length > 50, `expected many sites, got ${sites.length}`);
  const bedok = sites.find((s) => s.siteCode === 'BM');
  assert.ok(bedok, 'Bedok Mall present');
  assert.equal(bedok!.name, 'Bedok Mall');
  assert.equal(bedok!.businessUnit, 'Retail');
  assert.equal(typeof bedok!.lotsAvailable, 'number');
  assert.equal(typeof bedok!.lotsTotal, 'number');
  assert.ok(bedok!.lotsTotal! >= bedok!.lotsAvailable!);
});

test('accepts an already-parsed envelope object', () => {
  const obj = JSON.parse(fixtureRaw);
  const sites = parseJustParkResponse(obj);
  assert.ok(sites.length > 50);
});

test('throws when upstream flags HasError', () => {
  assert.throws(
    () => parseJustParkResponse({ HasError: true, Message: 'boom', Result: null }),
    /JustPark upstream error: boom/,
  );
});

test('degrades to [] on garbled body rather than throwing', () => {
  assert.deepEqual(parseJustParkResponse('not json'), []);
  assert.deepEqual(parseJustParkResponse({ HasError: false, Result: 'not json' }), []);
  assert.deepEqual(parseJustParkResponse({ HasError: false, Result: 42 }), []);
});

test('coerces string lot figures and skips rows without a SiteCode', () => {
  const sites = parseJustParkResponse({
    HasError: false,
    Result: JSON.stringify([
      { SiteCode: 'X1', SiteDesc: 'Test', BusinessUnitDesc: 'Retail', LotBalance: '12', LotTotal: '50', IsFull: false },
      { SiteDesc: 'No code', LotBalance: '1', LotTotal: '2' },
      { SiteCode: 'X2', SiteDesc: 'Garbled', LotBalance: 'abc', LotTotal: null, IsFull: true },
    ]),
  });
  assert.equal(sites.length, 2);
  assert.deepEqual(
    sites.map((s) => [s.siteCode, s.lotsAvailable, s.lotsTotal, s.isFull]),
    [
      ['X1', 12, 50, false],
      ['X2', null, null, true],
    ],
  );
});

test('maps known sites onto DB carpark ids and drops unmapped ones', () => {
  const sites: JustParkSite[] = [
    { siteCode: 'BM', name: 'Bedok Mall', businessUnit: 'Retail', lotsAvailable: 8, lotsTotal: 265, isFull: false },
    { siteCode: 'CQ', name: 'Clarke Quay', businessUnit: 'Retail', lotsAvailable: 260, lotsTotal: 383, isFull: false },
    { siteCode: '1JKG', name: 'Industrial', businessUnit: 'Business Parks', lotsAvailable: 15, lotsTotal: 37, isFull: false },
  ];
  const lots = toCarparkLots(sites);
  // CQ (not curated) and the industrial site are dropped; only BM maps.
  assert.equal(lots.length, 1);
  assert.deepEqual(lots[0], { id: 'LTA:65', lotsAvailable: 8, lotsTotal: 265 });
});

test('every mapped site code resolves against the fixture (catches stale codes)', () => {
  const sites = parseJustParkResponse(fixtureRaw);
  const present = new Set(sites.map((s) => s.siteCode));
  for (const code of Object.keys(SITE_TO_CARPARK_ID)) {
    assert.ok(present.has(code), `mapped SiteCode ${code} missing from live feed`);
  }
});
