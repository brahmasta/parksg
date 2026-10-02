import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vehicleCaveat } from './lotTypes';

test('motorcycle caveat credits rider reports, not "only HDB"', () => {
  const c = vehicleCaveat(['M']);
  assert.match(c, /known to have motorcycle lots, from HDB, URA and rider reports/);
  assert.doesNotMatch(c, /Only HDB/);
});

test('heavy-vehicle caveat lists only HDB and URA', () => {
  assert.match(vehicleCaveat(['H']), /heavy-vehicle lots, from HDB and URA\./);
});

test('both filters name both vehicles', () => {
  assert.match(vehicleCaveat(['M', 'H']), /motorcycle and heavy-vehicle lots/);
});
