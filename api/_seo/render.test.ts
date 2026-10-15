import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankByEstimate, renderAreaPage, renderCarparkPage } from './render';
import type { SeoCarpark } from './db';
import { SEO_AREAS } from './areas';
import type { RateRow } from '../../src/lib/types';

const halfHourly = (cents: number): RateRow => ({
  dayType: 'WEEKDAY',
  startTime: '00:00',
  endTime: '23:59',
  perBlockCents: cents,
  blockMinutes: 30,
  system: 'EPS',
  vehCat: 'CAR',
  source: 'HDB',
});

function carpark(slug: string, weekday: RateRow[], operator = 'HDB'): SeoCarpark {
  return {
    id: slug,
    slug,
    name: `Carpark ${slug}`,
    address: null,
    operator,
    lat: 1.3,
    lng: 103.85,
    totalLots: 50,
    parkingSystem: 'EPS',
    rates: { weekday, saturday: [], sundayPH: [] },
  };
}

test('carpark page with rates shows the estimate and schedule', () => {
  const page = renderCarparkPage(carpark('a', [halfHourly(60)]));
  assert.match(page.html, /Estimated cost \(weekday\)/);
  assert.match(page.html, /Weekday rates/);
  assert.match(page.head, /priceRange/);
});

test('carpark page with no rates says "Rate unknown" and invents no figure', () => {
  const page = renderCarparkPage(carpark('jtc-site', [], 'JTC'));
  assert.match(page.html, /Rate unknown/);
  assert.doesNotMatch(page.html, /Estimated cost/);
  assert.doesNotMatch(page.html, /Weekday rates/);
  assert.doesNotMatch(page.html, /\$\d/);
  assert.doesNotMatch(page.head, /priceRange/);
  assert.doesNotMatch(page.head, /with estimated costs/);
});

test('area ranking puts rate-unknown carparks last with no price', () => {
  const ranked = rankByEstimate([carpark('none', []), carpark('cheap', [halfHourly(60)])]);
  assert.deepEqual(
    ranked.map((c) => [c.slug, c.estOneHourCents]),
    [
      ['cheap', 120],
      ['none', null],
    ],
  );
  const html = renderAreaPage(SEO_AREAS[0], [carpark('none', [])]).html;
  assert.doesNotMatch(html, /~\$/);
});
