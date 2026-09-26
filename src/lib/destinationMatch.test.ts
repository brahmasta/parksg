import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findDestinationCarparkId } from './destinationMatch';
import type { Carpark } from './types';

function cp(id: string, name: string, walkMeters: number, google = false): Carpark {
  return {
    id,
    name,
    block: '',
    operator: 'LTA',
    lotTypes: ['C'],
    lotsAvailable: null,
    lotsTotal: 0,
    walkMin: 1,
    walkMeters,
    grace: 0,
    coords: { entrance: [0, 0] },
    rates: { weekday: [], saturday: [], sundayPH: [] },
    estByHours: { 0.5: 0, 1: 0, 1.5: 0, 2: 0, 3: 0, 4: 0 },
    ...(google ? { source: 'GOOGLE' as const } : {}),
  };
}

// The real neighbourhood from the user report: three malls within 200m of the
// Tampines Mall pin, surrounded by HDB carparks.
const TAMPINES = [
  cp('hdb:t54', 'BLK 513 Tampines Central 1', 157),
  cp('lta:63', 'Tampines Mall', 15),
  cp('lta:century_square', 'Century Square', 110),
  cp('lta:tampines_1', 'Tampines 1', 183),
  cp('hdb:tam1', 'BLK 507 Tampines Central 1', 312),
];

describe('findDestinationCarparkId', () => {
  it('pins the mall the user searched for, not its neighbours', () => {
    assert.equal(findDestinationCarparkId(TAMPINES, 'Tampines Mall'), 'lta:63');
    assert.equal(findDestinationCarparkId(TAMPINES, 'Century Square'), 'lta:century_square');
  });

  it('treats number words and digits alike ("Tampines One" ↔ "Tampines 1")', () => {
    assert.equal(findDestinationCarparkId(TAMPINES, 'Tampines One'), 'lta:tampines_1');
    assert.equal(
      findDestinationCarparkId([cp('lta:six_battery_road', 'Six Battery Road', 40)], '6 Battery Road'),
      'lta:six_battery_road',
    );
  });

  it('ignores case, punctuation and "Singapore"', () => {
    assert.equal(
      findDestinationCarparkId([cp('lta:slt', 'Singapore Land Tower', 30)], 'SINGAPORE LAND TOWER'),
      'lta:slt',
    );
    assert.equal(findDestinationCarparkId([cp('lta:24', '313@Somerset', 20)], '313 @ Somerset'), 'lta:24');
  });

  it('matches through generic words when the carpark is right there ("Funan" ↔ "Funan Mall")', () => {
    assert.equal(findDestinationCarparkId([cp('lta:66', 'Funan Mall', 60)], 'Funan'), 'lta:66');
  });

  it('does not pin a same-named mall for an area search far from it', () => {
    // "Tampines" reduces to the same core as "Tampines Mall", but the area
    // centroid is well away from the mall, so nothing is pinned.
    assert.equal(findDestinationCarparkId([cp('lta:63', 'Tampines Mall', 900)], 'Tampines'), null);
  });

  it('matches a building to its tower-level name by word prefix', () => {
    assert.equal(
      findDestinationCarparkId([cp('lta:asia_square', 'Asia Square', 120)], 'Asia Square Tower 1'),
      'lta:asia_square',
    );
  });

  it('does not treat a one-word prefix as a match ("Tampines Mall" ↛ "Tampines 1")', () => {
    assert.equal(findDestinationCarparkId([cp('lta:tampines_1', 'Tampines 1', 183)], 'Tampines Mall'), null);
  });

  it('rejects an exact name match too far away to be the same place', () => {
    assert.equal(findDestinationCarparkId([cp('x', 'Tampines Mall', 2_000)], 'Tampines Mall'), null);
  });

  it('prefers our own carpark over a Google duplicate, then the nearer one', () => {
    const list = [cp('google:1', 'Tampines Mall', 10, true), cp('lta:63', 'Tampines Mall', 30)];
    assert.equal(findDestinationCarparkId(list, 'Tampines Mall'), 'lta:63');
  });

  it('returns null for an empty or generic destination', () => {
    assert.equal(findDestinationCarparkId(TAMPINES, ''), null);
    assert.equal(findDestinationCarparkId(TAMPINES, 'My location'), null);
  });
});
