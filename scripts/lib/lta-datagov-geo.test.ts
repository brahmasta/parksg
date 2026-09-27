import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REVIEWED,
  coordsFileFrom,
  findDuplicate,
  hasUsablePrice,
  indexBuildings,
  lookupBuilding,
  nameVariants,
  parksElsewhere,
  planCoords,
  sameCarparkName,
  standalonePlacement,
  type Building,
  type DbRateRowLike,
  type LtaDataGovCoordsFile,
  type LtaDataGovRow,
  type PlacedCarpark,
} from './lta-datagov-geo';

// ── fixtures ──────────────────────────────────────────────────────────

const PRICED: DbRateRowLike = {
  per_block_cents: 60,
  block_minutes: 30,
  first_hour_cents: 120,
  per_entry_cents: null,
};
/** What migrateLtaCsv writes for a cell it can't parse. */
const STUB: DbRateRowLike = {
  per_block_cents: 0,
  block_minutes: 0,
  first_hour_cents: null,
  per_entry_cents: null,
};

function b(name: string, lat: number, lng: number, postal: string, extra: Partial<Building> = {}): Building {
  return { name, address: `${postal} Road, Singapore ${postal}`, postal, lat, lng, ...extra };
}

function row(id: string, name: string, extra: Partial<LtaDataGovRow> = {}): LtaDataGovRow {
  return { id, name, category: 'South & CBD', rateRows: [PRICED], ...extra };
}

// ── rates ─────────────────────────────────────────────────────────────

describe('hasUsablePrice', () => {
  it('rejects rows that would fall back to the invented $1.60/30min', () => {
    assert.equal(hasUsablePrice([]), false); // "Free" / per-entry rows dropped by rateRowToDb
    assert.equal(hasUsablePrice([STUB, STUB]), false); // "For Tenants only"
  });

  it('accepts any real price, even alongside stubs for other days', () => {
    assert.equal(hasUsablePrice([PRICED]), true);
    assert.equal(hasUsablePrice([STUB, PRICED]), true); // "Same as wkdays" Saturday stub
    assert.equal(hasUsablePrice([{ ...STUB, per_entry_cents: 300 }]), true); // flat per-entry
  });

  it('rejects a first-hour-only 0/0 row the app hides from the schedule', () => {
    assert.equal(hasUsablePrice([{ ...STUB, first_hour_cents: 200 }]), false);
  });
});

describe('standalonePlacement (what migrateLtaCsv applies on every sync)', () => {
  const coords: LtaDataGovCoordsFile = {
    'LTA:tampines_junction': {
      name: 'Tampines Junction',
      lat: 1.3527,
      lng: 103.9432,
      address: '300 Tampines Avenue 5, Singapore 529653',
      matchedBuilding: 'INCOME AT TAMPINES JUNCTION',
      source: 'onemap-2017',
    },
  };

  it('places a recreated standalone from the coords file', () => {
    assert.deepEqual(standalonePlacement('LTA:tampines_junction', [STUB, PRICED], coords), {
      lat: 1.3527,
      lng: 103.9432,
      address: '300 Tampines Avenue 5, Singapore 529653',
    });
  });

  it('withholds the point once the rows stop parsing to a real price', () => {
    assert.equal(standalonePlacement('LTA:tampines_junction', [STUB], coords), null);
  });

  it('leaves unknown ids without coordinates, as before', () => {
    assert.equal(standalonePlacement('LTA:somewhere_else', [PRICED], coords), null);
  });
});

// ── names ─────────────────────────────────────────────────────────────

describe('nameVariants', () => {
  it('tries the name, then without asides, then parts, then asides', () => {
    assert.deepEqual(nameVariants('Hub Synergy Point (Formerly Apex tower)'), [
      'Hub Synergy Point (Formerly Apex tower)',
      'Hub Synergy Point',
      'Apex tower',
    ]);
    assert.deepEqual(nameVariants('Keppel Bay Tower / Harbourfront Tower One'), [
      'Keppel Bay Tower / Harbourfront Tower One',
      'Keppel Bay Tower',
      'Harbourfront Tower One',
    ]);
  });

  it('ignores one-word asides and copes with the unclosed paren', () => {
    assert.deepEqual(nameVariants('IKEA (Alexandra)'), ['IKEA (Alexandra)', 'IKEA']);
    assert.deepEqual(nameVariants('The Battle Box ( Park at Fort Canning'), [
      'The Battle Box ( Park at Fort Canning',
      'The Battle Box',
      'Park at Fort Canning',
    ]);
  });
});

describe('sameCarparkName', () => {
  it('matches the known duplicates', () => {
    assert.ok(sameCarparkName('Clarke Quay', 'CQ @ Clarke Quay'));
    assert.ok(sameCarparkName('orchardgateway', 'Orchard Gateway'));
    assert.ok(sameCarparkName('Lot 1 Shopping Centre', 'Lot One'));
    assert.ok(sameCarparkName('Atrium @ Orchard', 'The Atrium@Orchard'));
    assert.ok(sameCarparkName('Millenia Walk (Basement Car Park)', 'Millenia Walk'));
    assert.ok(sameCarparkName('Cathay Cineleisure Orchard', 'Cineleisure Orchard'));
  });

  it('does not take a street carpark for a building on that street', () => {
    assert.equal(sameCarparkName('PARKROYAL on Beach Road', 'Beach Road'), false);
    assert.equal(
      sameCarparkName('Bukit Timah Shopping Centre', 'Service Road Off Upper Bukit Timah Road'),
      false,
    );
  });
});

describe('parksElsewhere', () => {
  it('spots rows that describe another carpark', () => {
    assert.equal(
      parksElsewhere({ name: 'Marina Mandarin Hotel', rateText: '7am-5pm: $2.20 (Car Park at Marina Square)' }),
      'Car Park at Marina Square',
    );
    assert.equal(parksElsewhere({ name: 'Royal Selangor Pewter Museum ( Park at Clarke Quay)' }), 'Park at Clarke Quay');
  });

  it('leaves "free parking at" and ordinary rows alone', () => {
    assert.equal(parksElsewhere({ name: 'Memories at Old Ford Factory', rateText: 'Daily free parking at Carparks C and D' }), null);
    assert.equal(parksElsewhere({ name: 'Tampines Junction', rateText: '$1.20 for 1st hr' }), null);
  });
});

// ── building lookup ───────────────────────────────────────────────────

describe('lookupBuilding', () => {
  it('matches on the name as written', () => {
    const index = indexBuildings([b('OCBC CENTRE', 1.2856, 103.8495, '049513')]);
    const hit = lookupBuilding('OCBC centre', index);
    assert.equal(hit.kind, 'match');
    assert.equal(hit.kind === 'match' && hit.building.postal, '049513');
  });

  it('flags a one-word name that only exists after dropping an aside as weak', () => {
    // OneMap's only "IKEA" is the Tampines store — not IKEA (Alexandra).
    const index = indexBuildings([b('IKEA', 1.374, 103.9325, '528764')]);
    assert.equal(lookupBuilding('IKEA (Alexandra)', index).kind, 'weak');
  });

  it('prefers the exact spelling when normalising merges distant names', () => {
    const index = indexBuildings([
      b('UOB PLAZA', 1.2856, 103.8502, '048624'),
      b('UOB THE PLAZA', 1.2998, 103.8607, '199590'), // a bank branch 2 km away
    ]);
    const hit = lookupBuilding('UOB Plaza', index);
    assert.equal(hit.kind === 'match' && hit.building.postal, '048624');
  });

  it('treats one name spread over a campus as one place, but not across the island', () => {
    const campus = indexBuildings([
      b('SINGAPORE EXPO', 1.3334, 103.9591, '486150'),
      b('SINGAPORE EXPO', 1.3368, 103.9636, '487370'), // ~600 m away
    ]);
    assert.equal(lookupBuilding('Singapore Expo', campus).kind, 'match');

    const chain = indexBuildings([
      b('HOLIDAY INN EXPRESS', 1.3025, 103.8365, '229921'),
      b('HOLIDAY INN EXPRESS', 1.3050, 103.9050, '428788'), // ~7 km away
    ]);
    assert.equal(lookupBuilding('Holiday Inn Express', chain).kind, 'ambiguous');
  });

  it('matches hotels OneMap names without "Hotel", and building-name variants', () => {
    const index = indexBuildings([
      b('MANDARIN ORIENTAL, SINGAPORE', 1.2903, 103.8578, '039797'),
      b('ALEXANDRA RETAIL CENTRE (ARC)', 1.2741, 103.8014, '119963'),
      b('HOTEL GRAND PACIFIC', 1.2978, 103.8527, '188018'),
    ]);
    assert.equal(lookupBuilding('Mandarin Oriental Hotel', index).kind, 'match');
    assert.equal(lookupBuilding('Alexandra Retail Centre', index).kind, 'match');
    assert.equal(lookupBuilding('Grand Pacific Hotel (Formerly Allson Hotel)', index).kind, 'match');
  });

  it('matches address-named rows by block and road in any word order', () => {
    const index = indexBuildings([
      b('', 1.3387, 103.8608, '319263', { blk: '25', road: 'LORONG 8 TOA PAYOH' }),
    ]);
    const hit = lookupBuilding('25 Toa Payoh Lorong 8', index);
    assert.equal(hit.kind === 'match' && hit.tier, 'address');
  });

  it('trusts hand-review aliases, even single words', () => {
    const index = indexBuildings([b('INCOME AT TAMPINES JUNCTION', 1.3527, 103.9432, '529653')]);
    assert.equal(lookupBuilding('Tampines Junction', index).kind, 'none');
    assert.equal(lookupBuilding('Tampines Junction', index, ['Income at Tampines Junction']).kind, 'match');
  });
});

// ── duplicates ────────────────────────────────────────────────────────

describe('findDuplicate', () => {
  const placed: PlacedCarpark[] = [{ id: 'LTA:59', name: 'CQ @ Clarke Quay', lat: 1.2906, lng: 103.8465 }];

  it('finds a same-named carpark nearby', () => {
    const dup = findDuplicate('Clarke Quay', { lat: 1.2911, lng: 103.8468 }, placed);
    assert.equal(dup?.carpark.id, 'LTA:59');
  });

  it('ignores one that is far away or differently named', () => {
    assert.equal(findDuplicate('Clarke Quay', { lat: 1.2960, lng: 103.8465 }, placed), null); // ~600 m
    assert.equal(findDuplicate('Central Mall', { lat: 1.2907, lng: 103.8466 }, placed), null);
  });
});

// ── the plan ──────────────────────────────────────────────────────────

describe('planCoords', () => {
  const buildings = [
    b('TAMPINES PLAZA', 1.3530, 103.9418, '529541'),
    b('CLARKE QUAY', 1.2908, 103.8467, '179024'),
    b('GRAND HYATT SINGAPORE', 1.3063, 103.8330, '228211'),
    b('LIANG COURT', 1.2915, 103.8445, '179030'),
  ];
  const plan = planCoords({
    rows: [
      row('LTA:tampines_plaza_compaq_centre', 'Tampines Plaza (Compaq Centre)'),
      row('LTA:clarke_quay', 'Clarke Quay'),
      row('LTA:grand_hyatt_hotel', 'Grand Hyatt Hotel', { category: 'Hotels' }),
      row('LTA:grand_hyatt_singapore', 'Grand Hyatt Singapore', { category: 'Orchard Area' }),
      row('LTA:liang_court', 'Liang Court'),
      row('LTA:singapore_land_tower', 'Singapore Land Tower', { rateRows: [STUB] }),
      row('LTA:marina_bay_sands', 'Marina Bay Sands'),
      row('LTA:pan_pacific_hotel', 'Pan Pacific Hotel', { rateText: '(Car Park at Marina Square)' }),
      row('LTA:nowhere_tower', 'Nowhere Tower'),
    ],
    buildings: [{ source: 'onemap-2017', index: indexBuildings(buildings) }],
    placed: [{ id: 'LTA:59', name: 'CQ @ Clarke Quay', lat: 1.2906, lng: 103.8465 }],
    protectedIds: new Set(['LTA:marina_bay_sands']),
  });
  const byId = new Map(plan.map((o) => [o.row.id, o]));
  const reason = (id: string) => {
    const o = byId.get(id);
    return o && o.status !== 'matched' ? o.reason : '';
  };

  it('places a name match', () => {
    const o = byId.get('LTA:tampines_plaza_compaq_centre');
    assert.equal(o?.status, 'matched');
    assert.equal(o?.status === 'matched' && o.coord.matchedBuilding, 'TAMPINES PLAZA');
  });

  it('skips duplicates, closures, missing prices, MANUAL rows and borrowed carparks', () => {
    assert.match(reason('LTA:clarke_quay'), /^duplicate of LTA:59/);
    assert.match(reason('LTA:liang_court'), /^closed/); // from REVIEWED
    assert.match(reason('LTA:singapore_land_tower'), /^no usable price/);
    assert.match(reason('LTA:marina_bay_sands'), /MANUAL/);
    assert.match(reason('LTA:pan_pacific_hotel'), /^no carpark of its own/);
  });

  it('keeps one pin when the CSV lists a building twice', () => {
    assert.equal(byId.get('LTA:grand_hyatt_singapore')?.status, 'matched');
    assert.match(reason('LTA:grand_hyatt_hotel'), /^same building as LTA:grand_hyatt_singapore/);
  });

  it('reports what it could not place', () => {
    assert.equal(byId.get('LTA:nowhere_tower')?.status, 'unmatched');
  });

  it('writes only matched rows, sorted, with rounded coordinates', () => {
    const file = coordsFileFrom(plan);
    assert.deepEqual(Object.keys(file), ['LTA:grand_hyatt_singapore', 'LTA:tampines_plaza_compaq_centre']);
  });
});

// ── the committed file ────────────────────────────────────────────────

/** Mirrors slugifyId in scripts/migrate-to-supabase.ts — the id the sync gives a CSV row. */
function slugifyId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

describe('scripts/data/lta-datagov-coords.json', () => {
  const file = JSON.parse(
    readFileSync(resolve(__dirname, '../data/lta-datagov-coords.json'), 'utf8'),
  ) as LtaDataGovCoordsFile;
  const entries = Object.entries(file);

  it('has entries', () => {
    assert.ok(entries.length > 100);
  });

  it('keys each entry by the id the sync gives that CSV name', () => {
    for (const [id, c] of entries) assert.equal(id, `LTA:${slugifyId(c.name)}`, id);
  });

  it('puts every point in Singapore with an address', () => {
    for (const [id, c] of entries) {
      assert.ok(c.lat > 1.2 && c.lat < 1.48 && c.lng > 103.6 && c.lng < 104.05, `${id} is off the island`);
      assert.ok(c.address.trim().length > 0, `${id} has no address`);
    }
  });

  it('never places a row the review skipped', () => {
    for (const [id, d] of Object.entries(REVIEWED)) {
      if ('skip' in d) assert.equal(file[id], undefined, `${id} was skipped: ${d.skip}`);
    }
  });

  it('never stacks two pins on one address', () => {
    const seen = new Map<string, string>();
    for (const [id, c] of entries) {
      assert.equal(seen.get(c.address), undefined, `${id} shares ${c.address} with ${seen.get(c.address)}`);
      seen.set(c.address, id);
    }
  });
});
