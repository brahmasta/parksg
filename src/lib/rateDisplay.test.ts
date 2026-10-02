import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeRate } from './rateDisplay';

test('a per-entry row stored with a 0/0 block shows the entry price', () => {
  // Capitol Singapore, weekday 6pm–11am: $3.45 per entry.
  assert.equal(
    synthesizeRate({ perBlockCents: 0, blockMinutes: 0, perEntryCents: 345, source: 'MANUAL' }),
    '$3.45 / entry',
  );
});

test('a $0 entry reads as Free', () => {
  assert.equal(synthesizeRate({ perBlockCents: 0, blockMinutes: 0, perEntryCents: 0, source: 'MANUAL' }), 'Free');
});

test('per-block and tiered rows are unchanged', () => {
  assert.equal(synthesizeRate({ perBlockCents: 60, blockMinutes: 30, source: 'URA' }), '$0.60 / 30 min');
  assert.equal(
    synthesizeRate({ firstHourCents: 245, perBlockCents: 55, blockMinutes: 15, source: 'MANUAL' }),
    '$2.45 / 1st hr · $0.55 / 15 min',
  );
});

test('a 0/0 row with nothing else still falls back', () => {
  assert.equal(synthesizeRate({ perBlockCents: 0, blockMinutes: 0, source: 'MANUAL' }), 'See operator');
});
