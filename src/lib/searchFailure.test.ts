import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failureCopy, retryOnce } from './searchFailure';

test('a place that does not exist cannot be retried', () => {
  const copy = failureCopy('place_not_found', ' Blk 999 Nowhere ');
  assert.equal(copy.canRetry, false);
  assert.match(copy.body, /“Blk 999 Nowhere”/);
});

test('lookup and load failures offer a retry and never read as "no carparks"', () => {
  for (const failure of ['place_lookup', 'carparks', 'unknown'] as const) {
    const copy = failureCopy(failure, 'Chinatown');
    assert.equal(copy.canRetry, true, failure);
    assert.doesNotMatch(`${copy.title} ${copy.body}`, /no carparks/i, failure);
  }
});

test('copy still reads without a query', () => {
  assert.doesNotMatch(failureCopy('carparks', '').body, /found {2}/);
  assert.doesNotMatch(failureCopy('place_not_found', '').body, /“”/);
});

test('retryOnce returns the first success without a second call', async () => {
  let calls = 0;
  const value = await retryOnce(async () => {
    calls++;
    return 'ok';
  }, 0);
  assert.equal(value, 'ok');
  assert.equal(calls, 1);
});

test('retryOnce recovers from one failure', async () => {
  let calls = 0;
  const value = await retryOnce(async () => {
    if (++calls === 1) throw new Error('dropped');
    return 'ok';
  }, 0);
  assert.equal(value, 'ok');
  assert.equal(calls, 2);
});

test('retryOnce gives up after the second failure', async () => {
  let calls = 0;
  await assert.rejects(
    retryOnce(async () => {
      calls++;
      throw new Error('down');
    }, 0),
    /down/,
  );
  assert.equal(calls, 2);
});
