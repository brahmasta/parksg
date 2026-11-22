import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffHdb, formatHdbDiff, type HdbDbRow, type HdbUpstreamRecord } from './hdb-sync-diff.ts';

const up = (code: string, over: Partial<HdbUpstreamRecord> = {}): HdbUpstreamRecord => ({
  car_park_no: code,
  address: `BLK ${code} TEST ROAD`,
  car_park_type: 'SURFACE CAR PARK',
  type_of_parking_system: 'ELECTRONIC PARKING',
  free_parking: 'NO',
  night_parking: 'YES',
  short_term_parking: 'WHOLE DAY',
  ...over,
});

const db = (code: string, over: Partial<HdbDbRow> = {}): HdbDbRow => ({
  source_code: code,
  address: `BLK ${code} TEST ROAD`,
  car_park_type: 'SURFACE CAR PARK',
  parking_system: 'EPS',
  raw: { free_parking: 'NO', night_parking: 'YES', short_term_parking: 'WHOLE DAY' },
  ...over,
});

test('identical data is all unchanged', () => {
  const d = diffHdb([up('A1'), up('A2')], [db('A1'), db('A2')]);
  assert.deepEqual([d.added, d.removed, d.changed, d.unchanged], [[], [], [], 2]);
});

test('new and closed carparks are listed, sorted', () => {
  const d = diffHdb([up('A1'), up('TH5'), up('BE47')], [db('A1'), db('HE17'), db('CKK1')]);
  assert.deepEqual(d.added, ['BE47', 'TH5']);
  assert.deepEqual(d.removed, ['CKK1', 'HE17']);
});

test('a coupon carpark converted to EPS is a change, with the direction', () => {
  const d = diffHdb([up('Q55')], [db('Q55', { parking_system: 'COUPON' })]);
  assert.deepEqual(d.changed, [{ code: 'Q55', fields: ['parking_system COUPON→EPS'] }]);
});

test('a change in a field the rate engine reads is reported', () => {
  const d = diffHdb([up('A1', { free_parking: 'SUN & PH FR 7AM-10.30PM' })], [db('A1')]);
  assert.deepEqual(d.changed, [{ code: 'A1', fields: ['free_parking'] }]);
});

test('case and spacing differences are not changes', () => {
  const d = diffHdb([up('A1', { address: ' blk a1 test road ' })], [db('A1')]);
  assert.equal(d.changed.length, 0);
});

test('rate fields are not compared when no earlier record was stored', () => {
  const d = diffHdb([up('A1', { free_parking: 'YES' })], [db('A1', { raw: null })]);
  assert.equal(d.changed.length, 0);
});

test('duplicate and blank source codes are ignored', () => {
  const d = diffHdb([up('A1'), up('A1'), up('')], [db('A1')]);
  assert.deepEqual([d.added.length, d.unchanged], [0, 1]);
});

test('the report warns that closed carparks are not deleted', () => {
  const text = formatHdbDiff(diffHdb([up('A1')], [db('A1'), db('HE17')]));
  assert.match(text, /Gone from source:\s+1\s+HE17/);
  assert.match(text, /NOT deleted/);
});
