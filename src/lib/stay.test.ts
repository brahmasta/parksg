import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Carpark, RateRow } from './types';
import { clampHours, fmtDuration, estCostForStay, type Stay } from './stay';

test('clampHours snaps to 0.5 and bounds to [0.5, 24]', () => {
  assert.equal(clampHours(0), 0.5);
  assert.equal(clampHours(0.3), 0.5);
  assert.equal(clampHours(2.2), 2);
  assert.equal(clampHours(2.25), 2.5);
  assert.equal(clampHours(99), 24);
});

test('fmtDuration formats m / h / h m', () => {
  assert.equal(fmtDuration(0.5), '30m');
  assert.equal(fmtDuration(2), '2h');
  assert.equal(fmtDuration(2.5), '2h 30m');
  assert.equal(fmtDuration(24), '24h');
});

function mk(over: Partial<Carpark> = {}): Carpark {
  return {
    id: 'x', name: 'X', block: '', operator: 'LTA', lotTypes: ['C'],
    lotsAvailable: 10, lotsTotal: 100, walkMin: 1, walkMeters: 100, grace: 0,
    coords: { entrance: [1.3, 103.8] },
    rates: { weekday: [], saturday: [], sundayPH: [] },
    estByHours: { 0.5: 0.6, 1: 1.2, 1.5: 1.8, 2: 2.4, 3: 3.6, 4: 4.8 },
    ...over,
  } as Carpark;
}

// A Monday 10:00 start so WEEKDAY rows apply.
const stayWeekday: Stay = { startMode: 'later', startAt: new Date(2026, 5, 1, 10, 0, 0), hours: 2 };

test('estCostForStay returns null for an unknown-rate (Google) carpark', () => {
  assert.equal(estCostForStay(mk({ rateUnknown: true }), stayWeekday), null);
});

test('estCostForStay prices arbitrary hours from structured rows', () => {
  // $1.20 per 30 min, all-day weekday → 2h = 4 blocks = $4.80.
  const row: RateRow = { dayType: 'WEEKDAY', perBlockCents: 120, blockMinutes: 30, source: 'URA' };
  const cp = mk({ rates: { weekday: [row], saturday: [], sundayPH: [] } });
  assert.equal(estCostForStay(cp, stayWeekday), 4.8);
  // 2.5h = 5 blocks = $6.00
  assert.equal(estCostForStay(cp, { ...stayWeekday, hours: 2.5 }), 6.0);
});

test('estCostForStay falls back to the flat preset rate when rows cannot price', () => {
  // No structured rows → use estByHours[0.5] ($0.60) × ceil(hours*2).
  const cp = mk();
  assert.equal(estCostForStay(cp, { ...stayWeekday, hours: 3 }), 3.6); // 6 × 0.60
});
