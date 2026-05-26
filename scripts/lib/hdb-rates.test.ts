import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferHdbRateRows, type HdbRateRow, type HdbRuleInput } from './hdb-rates';
import { estimateCostCentsAt } from '../../src/lib/rateMath';
import type { RateRow } from '../../src/lib/types';

const TODAY = '2026-05-26';
const EMPTY_PEAK: Set<string> = new Set();

function base(over: Partial<HdbRuleInput> = {}): HdbRuleInput {
  return {
    carparkId: 'HDB:TEST',
    parkingSystem: 'EPS',
    centralArea: false,
    raw: { car_park_no: 'TEST', night_parking: 'YES' },
    peakRestructuredCodes: EMPTY_PEAK,
    effectiveFrom: TODAY,
    ...over,
  };
}

function toRateRow(r: HdbRateRow): RateRow {
  return {
    dayType: r.day_type,
    startTime: r.start_time ? r.start_time.slice(0, 5) : undefined,
    endTime: r.end_time ? r.end_time.slice(0, 5) : undefined,
    perBlockCents: r.per_block_cents,
    blockMinutes: r.block_minutes,
    firstHourCents: r.first_hour_cents ?? undefined,
    perEntryCents: r.per_entry_cents ?? undefined,
    capCents: r.cap_cents ?? undefined,
    graceMinutes: r.grace_minutes ?? undefined,
    system: r.system,
    vehCat: r.veh_cat,
    source: r.source,
    effectiveFrom: r.effective_from ?? undefined,
  };
}

describe('inferHdbRateRows — row shape', () => {
  it('non-Central EPS with night parking → 6 rows (3 day + 3 night)', () => {
    const rows = inferHdbRateRows(base({ parkingSystem: 'EPS', centralArea: false }));
    assert.equal(rows.length, 6);
    const day = rows.filter((r) => r.start_time === '07:00:00');
    const night = rows.filter((r) => r.start_time === '22:30:00');
    assert.equal(day.length, 3);
    assert.equal(night.length, 3);
    assert.equal(day[0].per_block_cents, 60);
    assert.equal(day[0].cap_cents, 1200);
    assert.equal(day[0].grace_minutes, 15);
    assert.equal(night[0].cap_cents, 500);
    assert.ok(day.every((r) => r.system === 'EPS' && r.source === 'HDB'));
  });

  it('Central EPS → 6 rows, day cap $20, night cap $5, 120¢/30min', () => {
    const rows = inferHdbRateRows(base({ parkingSystem: 'EPS', centralArea: true }));
    assert.equal(rows.length, 6);
    const wd = rows.find((r) => r.day_type === 'WEEKDAY' && r.start_time === '07:00:00')!;
    assert.equal(wd.per_block_cents, 120);
    assert.equal(wd.cap_cents, 2000);
    const wdNight = rows.find((r) => r.day_type === 'WEEKDAY' && r.start_time === '22:30:00')!;
    assert.equal(wdNight.cap_cents, 500);
  });

  it('Coupon → 3 rows, NO cap, NO grace, NO night', () => {
    const rows = inferHdbRateRows(base({ parkingSystem: 'COUPON', centralArea: false }));
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.cap_cents == null));
    assert.ok(rows.every((r) => r.grace_minutes == null));
    assert.ok(rows.every((r) => r.system === 'COUPON' && r.source === 'HDB'));
  });

  it('EPS with raw.night_parking="NO" → 3 day rows only', () => {
    const rows = inferHdbRateRows(
      base({ raw: { car_park_no: 'TEST', night_parking: 'NO' } }),
    );
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.start_time === '07:00:00'));
  });

  it('Peak-restructured Central EPS → MANUAL rows, NO cap', () => {
    const rows = inferHdbRateRows(
      base({
        carparkId: 'HDB:RST1',
        centralArea: true,
        peakRestructuredCodes: new Set(['RST1']),
        peakBands: [
          {
            dayType: 'WEEKDAY',
            startTime: '07:00:00',
            endTime: '22:30:00',
            perBlockCents: 200, // hypothetical peak rate
            blockMinutes: 30,
          },
        ],
      }),
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].source, 'MANUAL');
    assert.equal(rows[0].per_block_cents, 200);
    assert.equal(rows[0].cap_cents, null); // explicitly disabled
  });

  it('Peak-restructured carpark but empty bands → falls back to standard Central', () => {
    const rows = inferHdbRateRows(
      base({
        carparkId: 'HDB:RST2',
        centralArea: true,
        peakRestructuredCodes: new Set(['RST2']),
        peakBands: [],
      }),
    );
    // Falls through → 6 standard Central rows
    assert.equal(rows.length, 6);
    assert.equal(rows[0].source, 'HDB');
  });
});

describe('end-to-end cost via estimateCostCentsAt', () => {
  // Worked examples from the plan.

  it('non-Central EPS, 2h stay at 10am weekday → $2.40', () => {
    const rows = inferHdbRateRows(base()).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'WEEKDAY', hourOfDay: 10 });
    assert.equal(cents, 240);
  });

  it('Central EPS, 12h stay starting 09:00 weekday → capped at $20', () => {
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 12, { dayType: 'WEEKDAY', hourOfDay: 9 });
    assert.equal(cents, 2000);
  });

  it('Coupon non-Central, 35min stay (≈ 0.583 hr) → 2 blocks × 60¢ = $1.20', () => {
    const rows = inferHdbRateRows(base({ parkingSystem: 'COUPON' })).map(toRateRow);
    // 35 min ceil-up → 2 × 30min blocks
    const cents = estimateCostCentsAt(rows, 35 / 60, {
      dayType: 'WEEKDAY',
      hourOfDay: 14,
    });
    assert.equal(cents, 120);
  });

  it('night-only stay 23:00 weekday, 8h overnight → hits $5 night cap', () => {
    // 8h × 2 × 60¢ = $9.60 raw → capped at $5.00
    const rows = inferHdbRateRows(base()).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 8, { dayType: 'WEEKDAY', hourOfDay: 23 });
    assert.equal(cents, 500);
  });

  it('short night stay 02:00 weekday, 1h → 2 blocks × 60¢ (cap not reached)', () => {
    // Sanity-check the band is being picked; 1h × 2 × 60¢ = $1.20, < $5 cap.
    const rows = inferHdbRateRows(base()).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 1, { dayType: 'WEEKDAY', hourOfDay: 2 });
    assert.equal(cents, 120);
  });

  it('peak-restructured central stay 2h weekday → MANUAL band rate, no cap', () => {
    const rows = inferHdbRateRows(
      base({
        carparkId: 'HDB:RST1',
        centralArea: true,
        peakRestructuredCodes: new Set(['RST1']),
        peakBands: [
          {
            dayType: 'WEEKDAY',
            startTime: '07:00:00',
            endTime: '22:30:00',
            perBlockCents: 200,
            blockMinutes: 30,
          },
        ],
      }),
    ).map(toRateRow);
    // 2h × 4 blocks × $2 = $8
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'WEEKDAY', hourOfDay: 10 });
    assert.equal(cents, 800);
  });
});
