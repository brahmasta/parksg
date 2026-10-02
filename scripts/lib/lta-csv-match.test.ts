import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeCsvNameMatcher, normaliseName } from './lta-csv-match';

/**
 * Which existing carparks an LTA 2018 CSV row's rates belong to
 * (migrateLtaCsv in scripts/migrate-to-supabase.ts). Names are real CSV rows
 * against real carparks.
 */

const match = makeCsvNameMatcher(
  new Map([
    ['LTA:61', 'Bugis+'],
    ['LTA:16', 'Vivocity P3'],
    ['LTA:50', 'VivoCity P2'],
    ['LTA:nex_mall', 'NEX'],
    ['LTA:55', 'Paragon'],
    ['OPERATOR:central_link', 'Central-Link'],
    ['LTA:17', 'Sentosa'],
    ['URA:K0114', 'Kampong Bugis'],
    ['LTA:66', 'Funan Mall'],
  ]),
);

describe('normaliseName', () => {
  it('lower-cases, spells out "&" and drops punctuation but keeps "@"', () => {
    assert.equal(normaliseName('Bugis+'), 'bugis');
    assert.equal(normaliseName('Sentosa (Tanjong & Palawan car park)'), 'sentosa tanjong and palawan car park');
    assert.equal(normaliseName('313@Somerset'), '313@somerset');
  });
});

describe('makeCsvNameMatcher', () => {
  it('does not let a one-word name claim a different building', () => {
    // "Bugis+" normalises to "bugis"; Bugis Junction is across Victoria Street.
    assert.deepEqual(match('Bugis Junction'), []);
    assert.deepEqual(match('Central ©'), []);
    assert.deepEqual(match('Sentosa (Beach and Imbiah car park)'), []);
  });

  it('fans a one-word name out to its carpark sections', () => {
    assert.deepEqual(match('Vivocity').sort(), ['LTA:16', 'LTA:50']);
  });

  it('matches a one-word name followed only by generic building words', () => {
    assert.deepEqual(match('Nex Mall'), ['LTA:nex_mall']);
    assert.deepEqual(match('Paragon Shopping Centre'), ['LTA:55']);
  });

  it('keeps the prefix match when the shorter name has two or more words', () => {
    assert.deepEqual(match('Vivocity P3 Carpark'), ['LTA:16']);
    assert.deepEqual(match('Kampong Bugis Off-Street'), ['URA:K0114']);
  });

  it('prefers an exact normalised match over prefix matches', () => {
    assert.deepEqual(match('VIVOCITY P2'), ['LTA:50']);
    assert.deepEqual(match('Funan Mall'), ['LTA:66']);
  });

  it('matches nothing for an empty name', () => {
    assert.deepEqual(match('  '), []);
  });
});
