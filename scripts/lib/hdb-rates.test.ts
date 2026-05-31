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

  it('Central EPS with night → 8 rows: Mon–Sat peak split, Sun flat, $0.60 night', () => {
    // WEEKDAY: 07–17 @120 + 17–22:30 @60 ; SAT: same (2) ; SUN_PH: 07–22:30 @60 (1)
    // night: 3 day_types @60 cap $5 ⇒ 2+2+1+3 = 8.
    const rows = inferHdbRateRows(base({ parkingSystem: 'EPS', centralArea: true }));
    assert.equal(rows.length, 8);

    // Mon–Sat peak band is the $1.20 rate, capped at $20.
    const wdPeak = rows.find((r) => r.day_type === 'WEEKDAY' && r.start_time === '07:00:00')!;
    assert.equal(wdPeak.end_time, '17:00:00');
    assert.equal(wdPeak.per_block_cents, 120);
    assert.equal(wdPeak.cap_cents, 2000);

    // …then $0.60 from 17:00 to 22:30.
    const wdOffPeak = rows.find((r) => r.day_type === 'WEEKDAY' && r.start_time === '17:00:00')!;
    assert.equal(wdOffPeak.end_time, '22:30:00');
    assert.equal(wdOffPeak.per_block_cents, 60);

    // Saturday is still peak.
    const satPeak = rows.find((r) => r.day_type === 'SAT' && r.start_time === '07:00:00')!;
    assert.equal(satPeak.per_block_cents, 120);

    // Sunday/PH has no peak split — a single $0.60 day band.
    const sunDay = rows.filter((r) => r.day_type === 'SUN_PH' && r.start_time === '07:00:00');
    assert.equal(sunDay.length, 1);
    assert.equal(sunDay[0].per_block_cents, 60);
    assert.equal(sunDay[0].end_time, '22:30:00');

    // Night is the $0.60 base rate (not the Central premium) with the $5 cap.
    const wdNight = rows.find((r) => r.day_type === 'WEEKDAY' && r.start_time === '22:30:00')!;
    assert.equal(wdNight.per_block_cents, 60);
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
    // Falls through → 8 standard Central rows (Mon–Sat peak split + night)
    assert.equal(rows.length, 8);
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

  it('Central EPS, 2h at 09:00 weekday → peak $1.20 rate → $4.80', () => {
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'WEEKDAY', hourOfDay: 9 });
    assert.equal(cents, 480);
  });

  it('Central EPS, 2h at 18:00 weekday (evening) → base $0.60 rate → $2.40', () => {
    // After 17:00 the Central premium no longer applies — used to over-charge $4.80.
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'WEEKDAY', hourOfDay: 18 });
    assert.equal(cents, 240);
  });

  it('Central EPS, 2h at 10:00 Sunday/PH → base $0.60 rate → $2.40', () => {
    // Sundays + public holidays are $0.60 all day at Central carparks too.
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'SUN_PH', hourOfDay: 10 });
    assert.equal(cents, 240);
  });

  it('Central EPS, 2h at 10:00 Saturday → still peak $1.20 → $4.80', () => {
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'SAT', hourOfDay: 10 });
    assert.equal(cents, 480);
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

describe('cross-band cost stitching', () => {
  // These exercise stays that span a band boundary — the case the old
  // single-dominant-band estimator over-charged.

  it('Central EPS, 2h from 16:00 weekday → 1h peak + 1h off-peak = $3.60', () => {
    // 16:00–17:00 peak: 2 × $1.20 = $2.40; 17:00–18:00 base: 2 × $0.60 = $1.20.
    // Old behaviour billed $1.20 for the whole 2h → $4.80; stitched = $3.60.
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'WEEKDAY', hourOfDay: 16 });
    assert.equal(cents, 360);
  });

  it('Central EPS, 3h from 15:00 weekday → 2h peak + 1h off-peak = $6.00', () => {
    // 15:00–17:00 peak: 4 × $1.20 = $4.80; 17:00–18:00 base: 2 × $0.60 = $1.20.
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 3, { dayType: 'WEEKDAY', hourOfDay: 15 });
    assert.equal(cents, 600);
  });

  it('Central Coupon, 2h from 16:00 weekday → stitches with no cap = $3.60', () => {
    const rows = inferHdbRateRows(base({ parkingSystem: 'COUPON', centralArea: true })).map(
      toRateRow,
    );
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'WEEKDAY', hourOfDay: 16 });
    assert.equal(cents, 360);
  });

  it('day cap and night cap are independent sessions across a day→night stay', () => {
    // Central, 12h from 18:00: 18:00–22:30 off-peak (9 × $0.60 = $5.40, under the
    // $20 day cap) + 22:30–06:00 night (15 × $0.60 = $9.00, capped at the $5
    // night cap). Total = $5.40 + $5.00 = $10.40. The two caps must NOT merge.
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 12, { dayType: 'WEEKDAY', hourOfDay: 18 });
    assert.equal(cents, 1040);
  });

  it('entering off-peak then walking into peak still charges each portion', () => {
    // 06:00 start, 2h: 06:00–07:00 is night band ($0.60, 2 blocks = $1.20),
    // 07:00–08:00 peak ($1.20, 2 blocks = $2.40). Total $3.60. Confirms the
    // walk re-evaluates the band each block in both directions.
    const rows = inferHdbRateRows(base({ centralArea: true })).map(toRateRow);
    const cents = estimateCostCentsAt(rows, 2, { dayType: 'WEEKDAY', hourOfDay: 6 });
    assert.equal(cents, 360);
  });
});
