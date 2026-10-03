import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inAppPath } from './deepLinks';

test('site links map to the same path in the app', () => {
  assert.equal(inAppPath('https://wheretopark.sg/carpark/vivocity'), '/carpark/vivocity');
  assert.equal(inAppPath('https://www.wheretopark.sg/parking-near/bugis'), '/parking-near/bugis');
  assert.equal(
    inAppPath('https://wheretopark.sg/?cp=LTA%3A65&to=1.3,103.8&dest=Bedok'),
    '/?cp=LTA%3A65&to=1.3,103.8&dest=Bedok',
  );
});

test('other hosts, schemes and junk are ignored', () => {
  assert.equal(inAppPath('https://example.com/carpark/vivocity'), null);
  assert.equal(inAppPath('http://wheretopark.sg/carpark/vivocity'), null);
  assert.equal(inAppPath('not a url'), null);
});
