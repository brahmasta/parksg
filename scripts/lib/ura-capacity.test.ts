import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toLotTypeUpdate, type UraCapacityEntry } from './ura-capacity';

const entries = JSON.parse(
  readFileSync(resolve(__dirname, '../data/ura-capacity.json'), 'utf8'),
) as UraCapacityEntry[];

describe('toLotTypeUpdate', () => {
  it('lists each vehicle type that has lots, in C→M→H order', () => {
    assert.deepEqual(
      toLotTypeUpdate({ ppCode: 'A0004', name: 'Aliwal Street', car: 69, motorcycle: 4, heavy: 0, updated: null }),
      { id: 'URA:A0004', lot_types: ['C', 'M'], motorcycle_lots: 4, heavy_lots: 0 },
    );
    assert.deepEqual(
      toLotTypeUpdate({ ppCode: 'X1', name: null, car: 0, motorcycle: 0, heavy: 12, updated: null }).lot_types,
      ['H'],
    );
  });
});

describe('ura-capacity.json', () => {
  it('has one well-formed row per parking place', () => {
    assert.ok(entries.length > 700, `expected ~777 rows, got ${entries.length}`);
    assert.equal(new Set(entries.map((e) => e.ppCode)).size, entries.length);
    for (const e of entries) {
      assert.match(e.ppCode, /^[A-Z0-9]{5}$/, `ppCode ${e.ppCode}`);
      for (const n of [e.car, e.motorcycle, e.heavy]) {
        assert.ok(Number.isInteger(n) && n >= 0, `${e.ppCode}: bad count ${n}`);
      }
    }
  });
});
