import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCarparkPage } from './render';
import type { SeoCarpark } from './db';

const base: SeoCarpark = {
  id: 'x',
  slug: 'operator-cuppage_plaza',
  name: 'Cuppage Plaza',
  address: '5 Koek Road',
  operator: 'Operator',
  lat: 1.3014,
  lng: 103.8408,
  totalLots: null,
  parkingSystem: 'EPS',
  rates: { weekday: [], saturday: [], sundayPH: [] },
};

test('a carpark inside a curated area links to that area page', () => {
  const page = renderCarparkPage(base);
  assert.match(page.body, /<a class="cta" href="\/parking-near\/somerset">Compare carparks near Somerset<\/a>/);
  assert.match(page.body, /cheapest for your stay/);
  // The breadcrumb runs site → area → carpark.
  const crumbs = /"@type":"BreadcrumbList","itemListElement":(\[.*?\])/.exec(page.head);
  assert.ok(crumbs);
  const items = JSON.parse(crumbs[1]) as { name: string; item: string }[];
  assert.deepEqual(
    items.map((i) => i.item),
    [
      'https://wheretopark.sg/',
      'https://wheretopark.sg/parking-near/somerset',
      'https://wheretopark.sg/carpark/operator-cuppage_plaza',
    ],
  );
});

test('a carpark outside every area gets no area link', () => {
  const page = renderCarparkPage({ ...base, lat: 1.2445, lng: 103.8415 });
  assert.doesNotMatch(page.body, /parking-near/);
  assert.doesNotMatch(page.head, /parking-near/);
});
