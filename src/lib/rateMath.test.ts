import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCostCents, estimateCostCentsAt } from './rateMath';
import type { RateRow } from './types';

function row(partial: Partial<RateRow>): RateRow {
  return { source: 'MANUAL', vehCat: 'CAR', ...partial };
}

// Funan (LTA:66) as it actually lives in the DB after the curated ingest: the
// daytime tiered window is fine, but the evening flat-rate window was corrupted
// — its end_time of "24:00" dropped to null and its absent per-block fields
// became 0, not null. The daytime end was clamped to 18:00. This is the exact
// shape that produced "$NaN" in the UI before the rateMath hardening.
const FUNAN_WEEKDAY: RateRow[] = [
  row({
    dayType: 'WEEKDAY',
    startTime: '00:00',
    endTime: '18:00',
    firstHourCents: 240,
    firstBlockMinutes: 60,
    perBlockCents: 65,
    blockMinutes: 15,
    system: 'FLAT',
  }),
  row({
    dayType: 'WEEKDAY',
    startTime: '18:00',
    endTime: undefined, // ← ingest dropped "24:00"
    perBlockCents: 0, // ← ingest emitted 0 for an absent field
    blockMinutes: 0, // ← ingest emitted 0 for an absent field
    perEntryCents: 330,
    system: 'FLAT',
  }),
];

describe('rateMath — Funan-shaped corrupted rows never emit NaN', () => {
  it('estimateCostCents picks the usable per-block row, never divides by zero', () => {
    const cents = estimateCostCents(FUNAN_WEEKDAY, 2);
    assert.ok(cents != null && Number.isFinite(cents), `expected finite, got ${cents}`);
    // first hour $2.40 + 4×$0.65 (second hour) = $5.00
    assert.equal(cents, 500);
  });

  it('daytime stay (14:00) bills the tiered daytime window', () => {
    const cents = estimateCostCentsAt(FUNAN_WEEKDAY, 2, { dayType: 'WEEKDAY', hourOfDay: 14 });
    assert.ok(cents != null && Number.isFinite(cents), `expected finite, got ${cents}`);
    assert.equal(cents, 500);
  });

  it('evening stay (20:00) bills the flat $3.30 per-entry, not NaN', () => {
    const cents = estimateCostCentsAt(FUNAN_WEEKDAY, 2, { dayType: 'WEEKDAY', hourOfDay: 20 });
    assert.equal(cents, 330);
  });

  it('the null-end evening row does not bleed into the morning (band dominance)', () => {
    // At 09:00 only the daytime window covers the block; if the evening row were
    // treated as all-day it would win dominance (5.5¢/min > 4.33¢/min) and the
    // morning would be mispriced as a flat $3.30.
    const cents = estimateCostCentsAt(FUNAN_WEEKDAY, 1, { dayType: 'WEEKDAY', hourOfDay: 9 });
    assert.equal(cents, 240); // just the first-hour tier
  });
});

describe('rateMath — usablePerBlock guards', () => {
  it('a pure flat per-entry row (no block fields at all) bills once', () => {
    const rows = [row({ dayType: 'WEEKDAY', perEntryCents: 500 })];
    assert.equal(estimateCostCents(rows, 3), 500);
    assert.equal(estimateCostCentsAt(rows, 3, { dayType: 'WEEKDAY', hourOfDay: 12 }), 500);
  });

  it('a row with perBlockCents=0/blockMinutes=0 + perEntry is billed flat', () => {
    const rows = [
      row({ dayType: 'WEEKDAY', perBlockCents: 0, blockMinutes: 0, perEntryCents: 420 }),
    ];
    const cents = estimateCostCents(rows, 4);
    assert.ok(cents != null && Number.isFinite(cents));
    assert.equal(cents, 420);
  });
});
