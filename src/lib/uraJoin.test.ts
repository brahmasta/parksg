import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { currentDayType } from './uraJoin';

// Date(year, monthIndex, day) builds a local-time date; currentDayType reads
// the same local components, so these assertions are timezone-stable.
describe('currentDayType — public-holiday aware', () => {
  it('weekday public holiday (Good Friday 2026-04-03, a Friday) → SUN_PH', () => {
    assert.equal(currentDayType(new Date(2026, 3, 3)), 'SUN_PH');
  });

  it('in-lieu Monday (National Day in lieu 2026-08-10) → SUN_PH, not WEEKDAY', () => {
    assert.equal(currentDayType(new Date(2026, 7, 10)), 'SUN_PH');
  });

  it('the Sunday holiday itself (National Day 2026-08-09) → SUN_PH', () => {
    assert.equal(currentDayType(new Date(2026, 7, 9)), 'SUN_PH');
  });

  it('ordinary weekday (Wed 2026-07-15) → WEEKDAY', () => {
    assert.equal(currentDayType(new Date(2026, 6, 15)), 'WEEKDAY');
  });

  it('ordinary Saturday (2026-06-06) → SAT', () => {
    assert.equal(currentDayType(new Date(2026, 5, 6)), 'SAT');
  });

  it('ordinary Sunday with no holiday (2026-07-12) → SUN_PH', () => {
    assert.equal(currentDayType(new Date(2026, 6, 12)), 'SUN_PH');
  });
});
