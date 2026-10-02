import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HDB_MOTORCYCLE_RATES, hdbHasMotorcycleLots } from './hdbMotorcycle';

test('matches by address, ignoring case and Block/Street spelling', () => {
  assert.equal(hdbHasMotorcycleLots(0, 0, 'Blk 253 Ang Mo Kio St 21'), true);
});

test('matches by location within 40m', () => {
  // Albert Centre basement carpark pin: 1.301063, 103.854118
  assert.equal(hdbHasMotorcycleLots(1.30115, 103.85420), true);
});

test('no match far from any listed carpark', () => {
  assert.equal(hdbHasMotorcycleLots(1.2, 103.6, 'Nowhere Road'), false);
});

test('HDB standard motorcycle rates: $0.65 day and night, every day type', () => {
  for (const rows of Object.values(HDB_MOTORCYCLE_RATES)) {
    assert.deepEqual(rows.map((r) => [r.startTime, r.endTime, r.perEntryCents]), [
      ['07:00', '22:30', 65],
      ['22:30', '07:00', 65],
    ]);
  }
});
