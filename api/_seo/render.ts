/**
 * HTML + JSON-LD rendering for the SEO landing pages.
 *
 * Pure string templating — no DOM, no framework. The route handlers
 * (api/carpark.ts, api/parking-near.ts) fetch data via _seo/db.ts and hand
 * it here to produce a full, crawlable HTML document. We deliberately reuse
 * the app's pure rate libs (rateMath, rateDisplay) so the numbers on the SSR
 * page match what the SPA shows.
 */

import type { RateRow } from '../../src/lib/types';
import { estimateCostCentsAt } from '../../src/lib/rateMath';
import {
  synthesizeWindow,
  synthesizeRate,
  synthesizeCap,
} from '../../src/lib/rateDisplay';
import type { SeoCarpark } from './db';
import type { SeoArea } from './areas';

export const ORIGIN = 'https://wheretopark.sg';
const SITE_NAME = 'wheretopark.sg';
const OG_IMAGE = `${ORIGIN}/og.png`;

/** A weekday mid-afternoon is the canonical "typical" slot we quote rates for. */
const SAMPLE_HOUR = 14;

// ─── primitives ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Cheapest weekday estimate across the given hours, in cents (or null). */
function cheapestWeekdayEstimate(
  rows: RateRow[],
  hours: number,
): number | null {
  return estimateCostCentsAt(rows, hours, {
    dayType: 'WEEKDAY',
    hourOfDay: SAMPLE_HOUR,
  });
}

// ─── document shell ──────────────────────────────────────────────────────

type ShellOpts = {
  title: string;
  description: string;
  canonical: string;
  bodyHtml: string;
  jsonLd?: object | object[];
};

function htmlShell({
  title,
  description,
  canonical,
  bodyHtml,
  jsonLd,
}: ShellOpts): string {
  const ld = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#fff}
@media(prefers-color-scheme:dark){body{color:#e7e7e7;background:#161616}a{color:#7db4ff}}
main{max-width:720px;margin:0 auto;padding:24px 18px 64px}
header a{font-weight:700;text-decoration:none;font-size:18px}
h1{font-size:26px;line-height:1.2;margin:18px 0 6px}
h2{font-size:18px;margin:28px 0 8px}
.muted{opacity:.7}
.cta{display:inline-block;margin:18px 0;padding:11px 18px;border-radius:10px;background:#0a84ff;color:#fff;text-decoration:none;font-weight:600}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:15px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #8883}
ul.cards{list-style:none;padding:0;margin:8px 0}
ul.cards li{padding:12px 0;border-bottom:1px solid #8883}
ul.cards a{font-weight:600;text-decoration:none}
.est{font-variant-numeric:tabular-nums}
footer{margin-top:40px;font-size:14px}
</style>
${ld}
</head>
<body>
<main>
<header><a href="/">${SITE_NAME}</a> <span class="muted">· Singapore parking rates</span></header>
${bodyHtml}
<footer class="muted">Live availability and turn-by-turn search are in the app. Rates shown are estimates — confirm at the gantry.</footer>
</main>
</body>
</html>`;
}

// ─── rate table ──────────────────────────────────────────────────────────

function rateTable(label: string, rows: RateRow[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .map((r) => {
      const cap = synthesizeCap(r);
      return `<tr><td>${escapeHtml(synthesizeWindow(r))}</td><td>${escapeHtml(
        synthesizeRate(r),
      )}</td><td>${cap ? escapeHtml(cap) : '—'}</td></tr>`;
    })
    .join('');
  return `<h2>${escapeHtml(label)}</h2>
<table><thead><tr><th>When</th><th>Rate</th><th>Cap</th></tr></thead><tbody>${body}</tbody></table>`;
}

/** "Estimated cost" mini-table for 1h / 2h / 3h on weekday rates. */
function estimateTable(rows: RateRow[]): string {
  const hoursList = [1, 2, 3];
  const cells = hoursList
    .map((h) => {
      const c = cheapestWeekdayEstimate(rows, h);
      return `<tr><td>${h} hour${h > 1 ? 's' : ''}</td><td class="est">${
        c == null ? '—' : escapeHtml(fmtDollars(c))
      }</td></tr>`;
    })
    .join('');
  return `<h2>Estimated cost (weekday)</h2>
<table><thead><tr><th>Duration</th><th>Est. cost</th></tr></thead><tbody>${cells}</tbody></table>`;
}

// ─── carpark page ────────────────────────────────────────────────────────

function carparkJsonLd(cp: SeoCarpark, oneHour: number | null): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ParkingFacility',
    name: cp.name,
    url: `${ORIGIN}/carpark/${cp.slug}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: cp.lat,
      longitude: cp.lng,
    },
  };
  if (cp.address) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: cp.address,
      addressCountry: 'SG',
    };
  }
  if (oneHour != null) ld.priceRange = `${fmtDollars(oneHour)}/hr est.`;
  return ld;
}

export function renderCarparkPage(
  cp: SeoCarpark,
  nearby: SeoCarpark[] = [],
): string {
  const oneHour = cheapestWeekdayEstimate(cp.rates.weekday, 1);
  const priceBit =
    oneHour != null ? ` from about ${fmtDollars(oneHour)}/hr (weekday est.)` : '';
  const addrBit = cp.address ? ` at ${cp.address}` : '';
  const description =
    `Parking rates for ${cp.name}${addrBit}${priceBit}. ` +
    `Operated by ${cp.operator}. Weekday, Saturday and Sunday/PH rates with estimated costs.`;
  const title = `${cp.name} parking rates & availability | ${SITE_NAME}`;
  const canonical = `${ORIGIN}/carpark/${cp.slug}`;

  const meta: string[] = [];
  if (cp.address) meta.push(escapeHtml(cp.address));
  meta.push(`Operator: ${escapeHtml(cp.operator)}`);
  if (cp.totalLots != null) meta.push(`${cp.totalLots} lots`);

  const nearbyHtml =
    nearby.length > 0
      ? `<h2>Nearby carparks</h2><ul class="cards">${nearby
          .map(
            (n) =>
              `<li><a href="/carpark/${n.slug}">${escapeHtml(
                n.name,
              )}</a>${n.address ? ` <span class="muted">${escapeHtml(n.address)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`
      : '';

  const bodyHtml = `
<h1>${escapeHtml(cp.name)}</h1>
<p class="muted">${meta.join(' · ')}</p>
<a class="cta" href="/?cp=${encodeURIComponent(cp.id)}">Open in app →</a>
${estimateTable(cp.rates.weekday)}
${rateTable('Weekday rates', cp.rates.weekday)}
${rateTable('Saturday rates', cp.rates.saturday)}
${rateTable('Sunday & public holiday rates', cp.rates.sundayPH)}
${nearbyHtml}
`;

  return htmlShell({
    title,
    description,
    canonical,
    bodyHtml,
    jsonLd: carparkJsonLd(cp, oneHour),
  });
}

// ─── area page ───────────────────────────────────────────────────────────

export type RankedCarpark = SeoCarpark & { estOneHourCents: number | null };

/** Rank carparks by cheapest weekday 1h estimate (nulls last). */
export function rankByEstimate(carparks: SeoCarpark[]): RankedCarpark[] {
  return carparks
    .map((c) => ({
      ...c,
      estOneHourCents: cheapestWeekdayEstimate(c.rates.weekday, 1),
    }))
    .sort((a, b) => {
      if (a.estOneHourCents == null) return 1;
      if (b.estOneHourCents == null) return -1;
      return a.estOneHourCents - b.estOneHourCents;
    });
}

function areaJsonLd(area: SeoArea, ranked: RankedCarpark[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Parking near ${area.name}`,
    url: `${ORIGIN}/parking-near/${area.slug}`,
    numberOfItems: ranked.length,
    itemListElement: ranked.slice(0, 20).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${ORIGIN}/carpark/${c.slug}`,
      name: c.name,
    })),
  };
}

export function renderAreaPage(
  area: SeoArea,
  carparks: SeoCarpark[],
): string {
  const ranked = rankByEstimate(carparks);
  const cheapest = ranked.find((c) => c.estOneHourCents != null);
  const priceBit = cheapest
    ? ` from about ${fmtDollars(cheapest.estOneHourCents as number)}/hr.`
    : '.';
  const title = `Parking near ${area.name} — cheapest options | ${SITE_NAME}`;
  const description =
    `Find and compare ${ranked.length} carparks near ${area.name}${priceBit} ` +
    `${area.blurb} Weekday rates and estimated costs.`;
  const canonical = `${ORIGIN}/parking-near/${area.slug}`;

  const list =
    ranked.length > 0
      ? `<ul class="cards">${ranked
          .map((c) => {
            const est =
              c.estOneHourCents != null
                ? `<span class="est muted"> · ~${fmtDollars(
                    c.estOneHourCents,
                  )}/hr</span>`
                : '';
            return `<li><a href="/carpark/${c.slug}">${escapeHtml(
              c.name,
            )}</a>${est}${
              c.address
                ? `<br><span class="muted">${escapeHtml(c.address)}</span>`
                : ''
            }</li>`;
          })
          .join('')}</ul>`
      : `<p class="muted">No carparks found in our data for this area yet.</p>`;

  const bodyHtml = `
<h1>Parking near ${escapeHtml(area.name)}</h1>
<p>${escapeHtml(area.blurb)}</p>
<a class="cta" href="/">Open the map in app →</a>
<h2>${ranked.length} carpark${ranked.length === 1 ? '' : 's'} nearby</h2>
${list}
`;

  return htmlShell({
    title,
    description,
    canonical,
    bodyHtml,
    jsonLd: areaJsonLd(area, ranked),
  });
}

// ─── sitemap ─────────────────────────────────────────────────────────────

export function renderSitemap(
  carparkSlugs: string[],
  areaSlugs: string[],
): string {
  const urls: string[] = [`${ORIGIN}/`];
  for (const slug of areaSlugs) urls.push(`${ORIGIN}/parking-near/${slug}`);
  for (const slug of carparkSlugs) urls.push(`${ORIGIN}/carpark/${slug}`);
  const body = urls
    .map((u) => `<url><loc>${escapeHtml(u)}</loc></url>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}
