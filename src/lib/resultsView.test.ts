import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickCheapestId, selectResultsView } from './resultsView';
import type { Carpark, RateSource, ResultsState } from './types';

/** Minimal Carpark for the fields selectResultsView / pickCheapestId read. */
function cp(
  id: string,
  opts: {
    walkMeters?: number;
    lotsAvailable?: number | null;
    ev?: boolean;
    cost?: number;
    source?: RateSource;
  } = {},
): Carpark {
  const cost = opts.cost ?? 0;
  return {
    id,
    name: id,
    block: '',
    operator: 'LTA',
    lotTypes: ['C'],
    lotsAvailable: opts.lotsAvailable ?? null,
    lotsTotal: 0,
    walkMin: 1,
    walkMeters: opts.walkMeters ?? 100,
    grace: 0,
    coords: { entrance: [0, 0] },
    rates: opts.source
      ? { weekday: [{ source: opts.source }], saturday: [], sundayPH: [] }
      : { weekday: [], saturday: [], sundayPH: [] },
    estByHours: { 0.5: cost, 1: cost, 1.5: cost, 2: cost, 3: cost, 4: cost },
    ...(opts.ev ? { ev: { hasCharging: true, lastUpdatedMin: 0, operators: [], connectors: [] } } : {}),
  } as Carpark;
}

const run = (carparks: Carpark[], availableOnly: boolean, evOnly: boolean, state: ResultsState = 'loaded') =>
  selectResultsView({ carparks, state, availableOnly, evOnly });

describe('selectResultsView — ranking', () => {
  it('sorts nearest-first', () => {
    const v = run([cp('far', { walkMeters: 300 }), cp('near', { walkMeters: 50 })], false, false);
    assert.deepEqual(v.ranked.map((c) => c.id), ['near', 'far']);
    assert.equal(v.evFilterEmpty, false);
    assert.equal(v.availFilterEmpty, false);
  });
});

describe('selectResultsView — Available-only empty state (BUG-1)', () => {
  it('flags availFilterEmpty when every carpark is full', () => {
    const v = run([cp('a', { lotsAvailable: 0 }), cp('b', { lotsAvailable: null })], true, false);
    assert.equal(v.ranked.length, 0);
    assert.equal(v.availFilterEmpty, true);
    assert.equal(v.evFilterEmpty, false);
  });

  it('does NOT flag when some lots are free', () => {
    const v = run([cp('a', { lotsAvailable: 0 }), cp('b', { lotsAvailable: 5 })], true, false);
    assert.deepEqual(v.ranked.map((c) => c.id), ['b']);
    assert.equal(v.availFilterEmpty, false);
  });

  it('does NOT flag when the filter is off (a genuinely empty area is a different state)', () => {
    const v = run([], true, false);
    assert.equal(v.availFilterEmpty, false); // nothing to attribute to the filter
  });
});

describe('selectResultsView — EV empty state takes priority', () => {
  it('flags evFilterEmpty when nothing has a charger', () => {
    const v = run([cp('a', { lotsAvailable: 5 }), cp('b', { lotsAvailable: 5 })], false, true);
    assert.equal(v.evFilterEmpty, true);
    assert.equal(v.availFilterEmpty, false);
  });

  it('EV+Available both on: EV passes some but all full → availFilterEmpty', () => {
    const v = run([cp('a', { ev: true, lotsAvailable: 0 }), cp('b', { lotsAvailable: 5 })], true, true);
    assert.equal(v.evFilterEmpty, false); // EV left a non-empty set ([a])
    assert.equal(v.availFilterEmpty, true); // ...which Available then cleared
  });

  it('EV+Available both on, nothing has a charger → evFilterEmpty wins', () => {
    const v = run([cp('a', { lotsAvailable: 0 }), cp('b', { lotsAvailable: 0 })], true, true);
    assert.equal(v.evFilterEmpty, true);
    assert.equal(v.availFilterEmpty, false);
  });
});

describe('pickCheapestId — stale rates never win unchallenged (TRUST-1)', () => {
  it('returns null for an empty list', () => {
    assert.equal(pickCheapestId([], 1), null);
  });

  it('picks the lowest cost when all are fresh', () => {
    const list = [cp('a', { cost: 300 }), cp('b', { cost: 200 }), cp('c', { cost: 500 })];
    assert.equal(pickCheapestId(list, 1), 'b');
  });

  it('does NOT award a stale 2018 carpark over a fresh one, even if cheaper', () => {
    const list = [
      cp('stale-cheap', { cost: 100, source: 'LTA_DATAGOV' }),
      cp('fresh-mid', { cost: 250, source: 'URA' }),
      cp('fresh-high', { cost: 400, source: 'HDB' }),
    ];
    assert.equal(pickCheapestId(list, 1), 'fresh-mid'); // cheapest *fresh*
  });

  it('falls back to the full list when every option is stale (apples-to-apples)', () => {
    const list = [
      cp('s1', { cost: 300, source: 'LTA_DATAGOV' }),
      cp('s2', { cost: 180, source: 'LTA_DATAGOV' }),
    ];
    assert.equal(pickCheapestId(list, 1), 's2');
  });

  it('treats a no-rates carpark (fallback rates) as fresh', () => {
    const list = [cp('stale', { cost: 100, source: 'LTA_DATAGOV' }), cp('fallback', { cost: 260 })];
    assert.equal(pickCheapestId(list, 1), 'fallback');
  });
});

describe('selectResultsView — sort + full-sinks-last', () => {
  it("sortBy 'cost' ranks by estimated cost ascending", () => {
    const v = selectResultsView({
      carparks: [cp('a', { cost: 300, lotsAvailable: 5 }), cp('b', { cost: 120, lotsAvailable: 5 }), cp('c', { cost: 240, lotsAvailable: 5 })],
      state: 'loaded', availableOnly: false, evOnly: false, sortBy: 'cost', duration: 1,
    });
    assert.deepEqual(v.ranked.map((c) => c.id), ['b', 'c', 'a']);
  });

  it('full carparks sink to the bottom regardless of sort', () => {
    const v = selectResultsView({
      carparks: [cp('full-cheap', { cost: 50, lotsAvailable: 0 }), cp('free-dear', { cost: 900, lotsAvailable: 9 })],
      state: 'loaded', availableOnly: false, evOnly: false, sortBy: 'cost', duration: 1,
    });
    assert.deepEqual(v.ranked.map((c) => c.id), ['free-dear', 'full-cheap']);
  });

  it("defaults to distance sort when sortBy is omitted (back-compat)", () => {
    const v = selectResultsView({
      carparks: [cp('far', { walkMeters: 300, cost: 1 }), cp('near', { walkMeters: 50, cost: 9 })],
      state: 'loaded', availableOnly: false, evOnly: false,
    });
    assert.deepEqual(v.ranked.map((c) => c.id), ['near', 'far']);
  });
});

describe('pickCheapestId — cheapest AVAILABLE, independent of sort', () => {
  it('skips a cheaper full carpark in favour of the cheapest with free lots', () => {
    const list = [cp('full', { cost: 100, lotsAvailable: 0 }), cp('free', { cost: 250, lotsAvailable: 5 })];
    assert.equal(pickCheapestId(list, 1), 'free');
  });

  it('falls back to the full set when nothing is available', () => {
    const list = [cp('a', { cost: 300, lotsAvailable: 0 }), cp('b', { cost: 180, lotsAvailable: 0 })];
    assert.equal(pickCheapestId(list, 1), 'b');
  });
});

describe('selectResultsView — only attributes on a settled state', () => {
  for (const state of ['loading', 'empty'] as ResultsState[]) {
    it(`no filter-empty flags while state='${state}'`, () => {
      const v = run([cp('a', { lotsAvailable: 0 })], true, true, state);
      assert.equal(v.evFilterEmpty, false);
      assert.equal(v.availFilterEmpty, false);
    });
  }

  it('still attributes on a degraded (stale-but-loaded) state', () => {
    const v = run([cp('a', { lotsAvailable: 0 })], true, false, 'degraded');
    assert.equal(v.availFilterEmpty, true);
  });
});

describe('selectResultsView — destination carpark pinned first', () => {
  // Searching "Tampines Mall": ~20 cheaper HDB lots used to bury the mall's own
  // carpark at the bottom of the cost-sorted list.
  const named = (id: string, name: string, opts: Parameters<typeof cp>[1]) => ({ ...cp(id, opts), name });
  const tampines = [
    named('hdb:t54', 'BLK 513 Tampines Central 1', { cost: 1.2, walkMeters: 157, lotsAvailable: 40 }),
    named('hdb:t12', 'BLK 156/160 Tampines Street 12', { cost: 1.2, walkMeters: 206, lotsAvailable: 12 }),
    named('lta:century_square', 'Century Square', { cost: 1.35, walkMeters: 110 }),
    named('lta:63', 'Tampines Mall', { cost: 1.35, walkMeters: 15, lotsAvailable: 191 }),
  ];

  it('pins the destination carpark above cheaper ones and ranks the rest by cost', () => {
    const v = selectResultsView({
      carparks: tampines, state: 'loaded', availableOnly: false, evOnly: false,
      sortBy: 'cost', duration: 1, destinationLabel: 'Tampines Mall',
    });
    assert.equal(v.pinnedId, 'lta:63');
    assert.deepEqual(v.ranked.map((c) => c.id), ['lta:63', 'hdb:t54', 'hdb:t12', 'lta:century_square']);
  });

  it('pins even when the destination carpark is full', () => {
    const full = tampines.map((c) => (c.id === 'lta:63' ? { ...c, lotsAvailable: 0 } : c));
    const v = selectResultsView({
      carparks: full, state: 'loaded', availableOnly: false, evOnly: false,
      sortBy: 'cost', duration: 1, destinationLabel: 'Tampines Mall',
    });
    assert.equal(v.ranked[0].id, 'lta:63');
  });

  it('does not bring back a pinned carpark the Available filter removed', () => {
    const v = selectResultsView({
      carparks: tampines, state: 'loaded', availableOnly: true, evOnly: false,
      sortBy: 'cost', duration: 1, destinationLabel: 'Century Square',
    });
    assert.equal(v.pinnedId, null); // Century Square has no live count
    assert.ok(!v.ranked.some((c) => c.id === 'lta:century_square'));
  });

  it('leaves the order alone when nothing matches the destination', () => {
    const v = selectResultsView({
      carparks: tampines, state: 'loaded', availableOnly: false, evOnly: false,
      sortBy: 'cost', duration: 1, destinationLabel: 'My location',
    });
    assert.equal(v.pinnedId, null);
    assert.equal(v.ranked[0].id, 'hdb:t54');
  });
});
