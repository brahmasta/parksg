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
    { siteCode: '1JKG', name: '1 Jalan Kilang', businessUnit: 'Business Parks', lotsAvailable: 15, lotsTotal: 37, isFull: false },
    { siteCode: '3C', name: 'The Chadwick/ The Curie/ The Cavendish', businessUnit: 'Business Parks', lotsAvailable: 40, lotsTotal: 183, isFull: false },
    { siteCode: 'XLAB', name: 'VPC - Xilin', businessUnit: 'Business Parks', lotsAvailable: null, lotsTotal: null, isFull: false },
  ];
  // XLAB (no count published) is dropped; 3C fans out to its three buildings.
  assert.deepEqual(toCarparkLots(sites), [
    { id: 'LTA:65', lotsAvailable: 8, lotsTotal: 265 },
    { id: 'OPERATOR:capitaland_1_jalan_kilang', lotsAvailable: 15, lotsTotal: 37 },
    { id: 'OPERATOR:the_chadwick', lotsAvailable: 40, lotsTotal: 183 },
    { id: 'OPERATOR:the_curie', lotsAvailable: 40, lotsTotal: 183 },
    { id: 'OPERATOR:the_cavendish', lotsAvailable: 40, lotsTotal: 183 },
  ]);
});

test('maps every site that publishes a count, and none that does not', () => {
  for (const s of parseJustParkResponse(fixtureRaw)) {
    if (s.lotsAvailable == null) {
      assert.equal(SITE_TO_CARPARK_ID[s.siteCode], undefined, `${s.siteCode} publishes no count`);
    } else {
      assert.ok(SITE_TO_CARPARK_ID[s.siteCode], `${s.siteCode} (${s.name}) has a live count but no carpark`);
    }
  }
});

test('every mapped id is a DataMall carpark or a row one of our ingests creates', () => {
  const dataDir = resolve(here, '../../../scripts/data');
  const slug = (n: string) =>
    n.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  const curated = JSON.parse(readFileSync(resolve(dataDir, 'curated-malls.json'), 'utf8')) as Array<{ id?: string; name: string }>;
  const sites = JSON.parse(readFileSync(resolve(dataDir, 'justpark-sites.json'), 'utf8')) as Array<{ code: string; id: string }>;
  const known = new Set([...curated.map((c) => c.id ?? `OPERATOR:${slug(c.name)}`), ...sites.map((s) => s.id)]);
  for (const [code, mapped] of Object.entries(SITE_TO_CARPARK_ID)) {
    for (const id of typeof mapped === 'string' ? [mapped] : mapped) {
      assert.ok(/^LTA:\d+$/.test(id) || known.has(id), `${code} → ${id} has no carpark row`);
    }
  }
  for (const s of sites) assert.equal(SITE_TO_CARPARK_ID[s.code], s.id, `justpark-sites.json ${s.code} not mapped`);
});

test('every mapped site code resolves against the fixture (catches stale codes)', () => {
  const sites = parseJustParkResponse(fixtureRaw);
  const present = new Set(sites.map((s) => s.siteCode));
  for (const code of Object.keys(SITE_TO_CARPARK_ID)) {
    assert.ok(present.has(code), `mapped SiteCode ${code} missing from live feed`);
  }
});
