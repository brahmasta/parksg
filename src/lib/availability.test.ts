import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lotsDisplay } from './availability';

describe('lotsDisplay — honest available/total presentation (DATA-1)', () => {
  it('known capacity → count, "of N lots", and % free', () => {
    const d = lotsDisplay(300, 1200, false);
    assert.equal(d.count, '300');
    assert.equal(d.secondary, `of ${(1200).toLocaleString()} lots`);
    assert.equal(d.pctFree, 25);
  });

  it('live count but UNKNOWN capacity → bare count, no fabricated total (VivoCity P2 case)', () => {
    const d = lotsDisplay(763, 0, false);
    assert.equal(d.count, '763');
    assert.equal(d.secondary, 'lots free'); // not "total unknown"
    assert.equal(d.pctFree, null);
  });

  it('zero free with unknown capacity reads as full, not "0 of unknown"', () => {
    const d = lotsDisplay(0, 0, false);
    assert.equal(d.count, '0');
    assert.equal(d.secondary, 'no lots free');
    assert.equal(d.pctFree, null);
  });

  it('zero free with known capacity → 0% free', () => {
    const d = lotsDisplay(0, 500, false);
    assert.equal(d.count, '0');
    assert.equal(d.pctFree, 0);
  });

  it('degraded feed → em dash, never a stale ratio', () => {
    const d = lotsDisplay(300, 1200, true);
    assert.equal(d.count, '—');
    assert.equal(d.secondary, 'live count updating');
    assert.equal(d.pctFree, null);
  });

  it('no live count (null) → em dash', () => {
    const d = lotsDisplay(null, 1200, false);
    assert.equal(d.count, '—');
    assert.equal(d.secondary, 'no live count');
    assert.equal(d.pctFree, null);
  });

  it('clamps an over-100% ratio (available > total data glitch)', () => {
    assert.equal(lotsDisplay(1300, 1000, false).pctFree, 100);
  });

  it('rounds to the nearest percent', () => {
    assert.equal(lotsDisplay(1, 3, false).pctFree, 33);
    assert.equal(lotsDisplay(2, 3, false).pctFree, 67);
  });
});
