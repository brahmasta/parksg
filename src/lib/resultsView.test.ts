import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectResultsView } from './resultsView';
import type { Carpark, ResultsState } from './types';

/** Minimal Carpark for the fields selectResultsView reads. */
function cp(
  id: string,
  opts: { walkMeters?: number; lotsAvailable?: number | null; ev?: boolean } = {},
): Carpark {
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
    rates: { weekday: [], saturday: [], sundayPH: [] },
    estByHours: { 0.5: 0, 1: 0, 1.5: 0, 2: 0, 3: 0, 4: 0 },
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
