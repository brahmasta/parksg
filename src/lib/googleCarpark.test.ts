import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Carpark } from './types';
import type { NearbyGooglePlace } from './api/googlePlaces';
import { googlePlaceToCarpark, filterNewGooglePlaces } from './googleCarpark';

const dest = { lat: 1.3000, lng: 103.8000 };

function gPlace(over: Partial<NearbyGooglePlace> = {}): NearbyGooglePlace {
  return {
    placeId: 'ChIJtest',
    name: 'Some Condo Carpark',
    address: '1 Some Road, Singapore 123456',
    lat: 1.3005,
    lng: 103.8005,
    parking: { free: null, paid: null },
    ...over,
  };
}

function dbCarpark(lat: number, lng: number, id = 'hdb:x1'): Carpark {
  return {
    id,
    name: 'DB carpark',
    block: 'Blk 1',
    operator: 'HDB',
    lotTypes: ['C'],
    lotsAvailable: 50,
    lotsTotal: 100,
    walkMin: 2,
    walkMeters: 120,
    grace: 10,
    coords: { entrance: [lat, lng] },
    rates: { weekday: [], saturday: [], sundayPH: [] },
    estByHours: { 0.5: 0.6, 1: 1.2, 1.5: 1.8, 2: 2.4, 3: 3.6, 4: 4.8 },
  };
}

test('googlePlaceToCarpark marks rate/lots unknown and tags provenance', () => {
  const cp = googlePlaceToCarpark(gPlace(), dest);
  assert.equal(cp.id, 'google:ChIJtest');
  assert.equal(cp.placeId, 'ChIJtest');
  assert.equal(cp.source, 'GOOGLE');
  assert.equal(cp.rateUnknown, true);
  assert.equal(cp.lotsAvailable, null);
  assert.equal(cp.lotsTotal, 0);
  assert.deepEqual(cp.rates, { weekday: [], saturday: [], sundayPH: [] });
  // Sentinel estimate is all-zero and must never be shown.
  assert.deepEqual(Object.values(cp.estByHours), [0, 0, 0, 0, 0, 0]);
  // Walk distance computed from the destination (≈ 78 m for this offset).
  assert.ok(cp.walkMeters > 50 && cp.walkMeters < 120);
  assert.ok(cp.walkMin >= 1);
});

test('googlePlaceToCarpark carries the free/paid hint', () => {
  const free = googlePlaceToCarpark(gPlace({ parking: { free: true, paid: false } }), dest);
  assert.deepEqual(free.googleParking, { free: true, paid: false });
});

test('filterNewGooglePlaces drops a Google place within 60m of a DB carpark', () => {
  // ~22 m north of the Google place — should be deduped out.
  const near = dbCarpark(1.3007, 103.8005);
  const google = [googlePlaceToCarpark(gPlace(), dest)];
  assert.equal(filterNewGooglePlaces(google, [near]).length, 0);
});

test('filterNewGooglePlaces keeps a Google place with no nearby DB carpark', () => {
  // ~1.5 km away — genuinely net-new.
  const far = dbCarpark(1.3140, 103.8005);
  const google = [googlePlaceToCarpark(gPlace(), dest)];
  const kept = filterNewGooglePlaces(google, [far]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, 'google:ChIJtest');
});

test('filterNewGooglePlaces handles an empty DB set (all kept)', () => {
  const google = [googlePlaceToCarpark(gPlace(), dest), googlePlaceToCarpark(gPlace({ placeId: 'ChIJtest2', lat: 1.301, lng: 103.801 }), dest)];
  assert.equal(filterNewGooglePlaces(google, []).length, 2);
});
