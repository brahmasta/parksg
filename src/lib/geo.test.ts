import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inSingapore } from './geo';

test('inSingapore: island-wide points are in, nearby countries are out', () => {
  assert.ok(inSingapore(1.3048, 103.8318)); // Orchard Road
  assert.ok(inSingapore(1.4294, 103.8355)); // Yishun
  assert.ok(inSingapore(1.2494, 103.8303)); // Sentosa
  assert.ok(!inSingapore(37.3349, -122.009)); // Cupertino
  assert.ok(!inSingapore(1.4927, 103.7414)); // Johor Bahru
  assert.ok(!inSingapore(-6.2, 106.8166)); // Jakarta
});
