import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { heightOrNull, parseRates } from './carparkWrite';

// The rates proposed for 18 Cross Carpark (a real approved submission whose
// rates never reached rate_rows): a per-block weekday band plus per-entry
// evening/weekend bands with no per-block pair.
const EIGHTEEN_CROSS = [
  { system: 'EPS', day_type: 'WEEKDAY', start_time: '08:00', end_time: '18:00', block_minutes: 30, per_block_cents: 190, per_entry_cents: null, first_hour_cents: null, cap_cents: null, grace_minutes: null },
  { system: 'EPS', day_type: 'WEEKDAY', start_time: '18:00', end_time: '08:00', block_minutes: null, per_block_cents: null, per_entry_cents: 320, first_hour_cents: null, cap_cents: 320, grace_minutes: null },
  { system: 'EPS', day_type: 'SAT', start_time: '8:00', end_time: '08:00:00', block_minutes: null, per_block_cents: null, per_entry_cents: 320, first_hour_cents: null, cap_cents: 320, grace_minutes: null },
];

describe('parseRates', () => {
  it('never emits null for the NOT NULL per-block columns (per-entry rows get 0/0)', () => {
    const rows = parseRates(EIGHTEEN_CROSS, 'MANUAL:18_cross_carpark');
    for (const r of rows) {
      assert.equal(typeof r.per_block_cents, 'number');
      assert.equal(typeof r.block_minutes, 'number');
    }
    assert.deepEqual([rows[1].per_block_cents, rows[1].block_minutes, rows[1].per_entry_cents], [0, 0, 320]);
  });

  it('keeps a real per-block rate untouched', () => {
    const [weekday] = parseRates(EIGHTEEN_CROSS, 'x');
    assert.deepEqual(
      [weekday.start_time, weekday.end_time, weekday.per_block_cents, weekday.block_minutes],
      ['08:00', '18:00', 190, 30],
    );
  });

  it('stores a start === end band ("08:00"–"08:00") as all-day', () => {
    const sat = parseRates(EIGHTEEN_CROSS, 'x')[2];
    assert.equal(sat.start_time, null);
    assert.equal(sat.end_time, null);
    // A midnight-crossing band is not all-day.
    const evening = parseRates(EIGHTEEN_CROSS, 'x')[1];
    assert.deepEqual([evening.start_time, evening.end_time], ['18:00', '08:00']);
  });

  it('still rejects an unknown day_type', () => {
    assert.throws(() => parseRates([{ day_type: 'MON' }], 'x'), /bad day_type/);
  });
});

test('heightOrNull keeps 1.2–6m clearances rounded to cm, rejects the rest', () => {
  assert.equal(heightOrNull(2.15), 2.15);
  assert.equal(heightOrNull('2.1'), 2.1);
  assert.equal(heightOrNull(2.156), 2.16);
  assert.equal(heightOrNull(0), null);
  assert.equal(heightOrNull(9.99), null);
  assert.equal(heightOrNull(''), null);
  assert.equal(heightOrNull(null), null);
});
