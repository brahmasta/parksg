import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { areaFromPostal } from './postalArea';

describe('areaFromPostal — SG postal sector → locality', () => {
  it('reads the sector from a full mall address', () => {
    // Causeway Point: 1 Woodlands Square, Singapore 738099 → sector 73 → Kranji
    assert.equal(areaFromPostal('1 Woodlands Square, Singapore 738099'), 'Kranji');
  });

  it('maps Orchard sectors (22/23)', () => {
    assert.equal(areaFromPostal('2 Orchard Turn, Singapore 238801'), 'Orchard');
  });

  it('maps Tampines (51)', () => {
    assert.equal(areaFromPostal('4 Tampines Central 5, Singapore 529510'), 'Tampines');
  });

  it('maps the two extra Changi/Punggol sectors (81/82)', () => {
    assert.equal(areaFromPostal('Singapore 819663'), 'Changi'); // 81
    assert.equal(areaFromPostal('Singapore 828761'), 'Punggol'); // 82
  });

  it('returns null when there is no 6-digit postal', () => {
    assert.equal(areaFromPostal('BLK 123 ANG MO KIO AVE 3'), null);
  });

  it('returns null for an unallocated sector (74)', () => {
    assert.equal(areaFromPostal('Singapore 740001'), null);
  });

  it('returns null for empty / nullish input', () => {
    assert.equal(areaFromPostal(''), null);
    assert.equal(areaFromPostal(undefined), null);
    assert.equal(areaFromPostal(null), null);
  });

  it('ignores non-6-digit number runs', () => {
    assert.equal(areaFromPostal('Blk 12345 something'), null); // 5 digits
    assert.equal(areaFromPostal('unit 1234567'), null); // 7 digits, no word-boundary 6-run
  });
});
