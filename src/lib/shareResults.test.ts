import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultsShareUrl } from './shareResults';

const dest = { label: 'Bugis Junction', lat: 1.2999, lng: 103.8558 };

test('an area page shares its clean /parking-near path', () => {
  assert.equal(
    resultsShareUrl(dest, { origin: 'https://wheretopark.sg', pathname: '/parking-near/bugis/' }),
    'https://wheretopark.sg/parking-near/bugis',
  );
});

test('any other destination shares coords + label with no carpark', () => {
  const url = new URL(resultsShareUrl(dest, { origin: 'https://wheretopark.sg', pathname: '/' }));
  assert.equal(url.pathname, '/');
  assert.equal(url.searchParams.get('to'), '1.299900,103.855800');
  assert.equal(url.searchParams.get('dest'), 'Bugis Junction');
  assert.equal(url.searchParams.has('cp'), false);
});
