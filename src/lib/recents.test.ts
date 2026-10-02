import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadRecents, pushRecent } from './recents';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

beforeEach(() => store.clear());

test('a new visitor has no recents', () => {
  assert.deepEqual(loadRecents(), []);
});

test('legacy placeholder entries saved by earlier builds are dropped', () => {
  store.set(
    'psg.recents',
    JSON.stringify([
      { name: 'Bugis Junction', hint: '188021', lat: 1.3, lng: 103.85 },
      { name: 'Vivocity', hint: 'HarbourFront' },
      { name: '313 Somerset', hint: 'Orchard' },
      { name: 'Jewel Changi', hint: 'Airport' },
      { name: 'Tiong Bahru Plaza', hint: 'Bukit Merah' },
    ]),
  );
  assert.deepEqual(loadRecents().map((r) => r.name), ['Bugis Junction']);
});

test('a real search for a placeholder name is kept (it has coords)', () => {
  store.set('psg.recents', JSON.stringify([{ name: 'Vivocity', hint: 'HarbourFront', lat: 1.26, lng: 103.82 }]));
  assert.equal(loadRecents().length, 1);
});

test('pushRecent no longer drags placeholders into storage', () => {
  const next = pushRecent({ name: 'Funan', hint: '179097', lat: 1.29, lng: 103.85 });
  assert.deepEqual(next.map((r) => r.name), ['Funan']);
});
