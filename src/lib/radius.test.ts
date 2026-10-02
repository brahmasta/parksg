import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtRadius, widerRadius } from './radius';

test('fmtRadius uses m under 1km and km above', () => {
  assert.equal(fmtRadius(600), '600m');
  assert.equal(fmtRadius(1000), '1km');
  assert.equal(fmtRadius(1500), '1.5km');
});

test('widerRadius steps to the next option and stops at the largest', () => {
  assert.equal(widerRadius(600), 1000);
  assert.equal(widerRadius(1000), 1500);
  assert.equal(widerRadius(2000), null);
});
