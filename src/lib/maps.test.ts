import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  availableProviders,
  mapsDirectionsUrl,
  parseProvider,
} from './maps';

const LAT = 1.3024;
const LNG = 103.8349;

describe('mapsDirectionsUrl', () => {
  it('builds a Google Maps driving-directions link', () => {
    assert.equal(
      mapsDirectionsUrl('google', LAT, LNG),
      'https://www.google.com/maps/dir/?api=1&destination=1.3024,103.8349&travelmode=driving',
    );
  });

  it('builds a Waze navigate link', () => {
    assert.equal(
      mapsDirectionsUrl('waze', LAT, LNG),
      'https://waze.com/ul?ll=1.3024,103.8349&navigate=yes',
    );
  });

  it('builds an Apple Maps driving link', () => {
    assert.equal(
      mapsDirectionsUrl('apple', LAT, LNG),
      'https://maps.apple.com/?daddr=1.3024,103.8349&dirflg=d',
    );
  });
});

describe('availableProviders — Apple gating', () => {
  it('Apple device → all three, Apple last', () => {
    assert.deepEqual(availableProviders(true), ['google', 'waze', 'apple']);
  });
  it('non-Apple → Google + Waze only (no degraded Apple web fallback)', () => {
    assert.deepEqual(availableProviders(false), ['google', 'waze']);
  });
});

describe('parseProvider', () => {
  it('accepts the three valid providers', () => {
    assert.equal(parseProvider('google'), 'google');
    assert.equal(parseProvider('waze'), 'waze');
    assert.equal(parseProvider('apple'), 'apple');
  });
  it('rejects junk and nullish', () => {
    for (const bad of ['', 'maps', 'GOOGLE', 'bing', null, undefined]) {
      assert.equal(parseProvider(bad as string | null | undefined), null);
    }
  });
});
