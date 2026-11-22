import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEO_AREAS, areaContaining, findArea } from './seoAreas';

test('a point at an area centre belongs to that area', () => {
  for (const area of SEO_AREAS) {
    // Overlapping areas (Tiong Bahru / Bukit Merah) may share a centre's
    // neighbourhood, but a centre is always nearest to itself.
    assert.equal(areaContaining(area)?.slug, area.slug, area.slug);
  }
});

test('where areas overlap, the nearer centre wins', () => {
  // Cuppage Plaza: inside both Orchard (700 m) and Somerset (600 m), nearer Somerset.
  assert.equal(areaContaining({ lat: 1.3014, lng: 103.8408 })?.slug, 'somerset');
});

test('a point outside every area radius has no area', () => {
  // Sentosa Cove.
  assert.equal(areaContaining({ lat: 1.2445, lng: 103.8415 }), undefined);
  // Just past Orchard's 700 m radius, to the north-west and clear of its neighbours.
  const orchard = findArea('orchard')!;
  assert.equal(areaContaining({ lat: orchard.lat + 0.012, lng: orchard.lng - 0.012 }), undefined);
});
