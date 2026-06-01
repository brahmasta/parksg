import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { firstRateRow, isStaleRates, rateSourceOf } from './rateSource';
import type { Carpark, RateRow } from './types';

function cp(rates: Partial<Carpark['rates']>): Carpark {
  return {
    id: 'x',
    name: 'x',
    block: '',
    operator: 'LTA',
    lotTypes: ['C'],
    lotsAvailable: null,
    lotsTotal: 0,
    walkMin: 1,
    walkMeters: 100,
    grace: 0,
    coords: { entrance: [0, 0] },
    rates: { weekday: [], saturday: [], sundayPH: [], ...rates },
    estByHours: { 0.5: 0, 1: 0, 1.5: 0, 2: 0, 3: 0, 4: 0 },
  } as Carpark;
}

const row = (source: RateRow['source']): RateRow => ({ source });

describe('rateSource helpers', () => {
  it('firstRateRow prefers weekday, then saturday, then sundayPH', () => {
    assert.equal(firstRateRow(cp({ weekday: [row('URA')], saturday: [row('HDB')] }))?.source, 'URA');
    assert.equal(firstRateRow(cp({ saturday: [row('HDB')], sundayPH: [row('URA')] }))?.source, 'HDB');
    assert.equal(firstRateRow(cp({ sundayPH: [row('MANUAL')] }))?.source, 'MANUAL');
    assert.equal(firstRateRow(cp({})), null);
  });

  it('rateSourceOf returns the representative source or null', () => {
    assert.equal(rateSourceOf(cp({ weekday: [row('LTA_DATAGOV')] })), 'LTA_DATAGOV');
    assert.equal(rateSourceOf(cp({})), null);
  });

  it('isStaleRates is true only for the 2018 LTA_DATAGOV snapshot', () => {
    assert.equal(isStaleRates(cp({ weekday: [row('LTA_DATAGOV')] })), true);
    for (const s of ['URA', 'HDB', 'MANUAL', 'LTA_DATAMALL', 'CAG', 'OPERATOR'] as const) {
      assert.equal(isStaleRates(cp({ weekday: [row(s)] })), false, `${s} should not be stale`);
    }
    assert.equal(isStaleRates(cp({})), false); // no rates → not flagged
  });
});
