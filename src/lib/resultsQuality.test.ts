import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultsQuality } from './resultsQuality.ts';
import type { Carpark } from './types.ts';

const cp = (extra: Partial<Carpark>) => ({ id: 'x', ...extra }) as Carpark;

test('splits priced, estimated and unknown', () => {
  const q = resultsQuality([
    cp({}),
    cp({}),
    cp({ rateEstimated: true }),
    cp({ rateUnknown: true }),
  ]);
  assert.deepEqual(q, { count: 4, priced: 2, estimated: 1, unknown: 1 });
});

test('empty results', () => {
  assert.deepEqual(resultsQuality([]), { count: 0, priced: 0, estimated: 0, unknown: 0 });
});
