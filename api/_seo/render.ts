/**
 * HTML + JSON-LD rendering for the SEO landing pages.
 *
 * Pure string templating — no DOM, no framework. The route handlers
 * (api/carpark.ts, api/parking-near.ts, api/home.ts) fetch data via _seo/db.ts
 * and hand it here to produce crawlable HTML.
 *
 * Each renderer returns three pieces:
 *   - `head` — the per-page <title>/description/canonical/OG/JSON-LD tags,
 *     injected into the built SPA shell between the SEO_HEAD markers (so the
 *     same URL boots the live app AND carries correct crawlable metadata);
 *   - `body` — the crawlable `<main>` content, injected into `#root` as
 *     fallback (React replaces it on mount, so humans get the live app);
 *   - `html` — a complete standalone document, used as a graceful fallback if
 *     the shell can't be read (so routes never 500).
 *
 * We deliberately reuse the app's pure rate libs (rateMath, rateDisplay) so the
 * numbers on the SSR page match what the SPA shows.
 */

import type { RateRow } from '../../src/lib/types';
import { estimateCostCentsAt } from '../../src/lib/rateMath';
import {
  synthesizeWindow,
  synthesizeRate,
  synthesizeCap,
} from '../../src/lib/rateDisplay';
import type { SeoCarpark } from './db';
import { type SeoArea, SEO_AREAS, nearestAreas } from './areas';

export const ORIGIN = 'https://wheretopark.sg';
const SITE_NAME = 'wheretopark.sg';
const OG_IMAGE = `${ORIGIN}/og.png`;

/** A weekday mid-afternoon is the canonical "typical" slot we quote rates for. */
const SAMPLE_HOUR = 14;

/** The three pieces every renderer returns. See the file header. */
export type RenderedPage = { head: string; body: string; html: string };

// ─── primitives ──────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
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
export function cheapestWeekdayEstimate(
  rows: RateRow[],
  hours: number,
): number | null {
  return estimateCostCentsAt(rows, hours, {
    dayType: 'WEEKDAY',
    hourOfDay: SAMPLE_HOUR,
  });
}

// ─── document shell ──────────────────────────────────────────────────────

/** Inline CSS for the crawlable fallback body. Kept tiny — it only styles the
 *  no-JS view; humans see the React app, which has its own styling. */
const SEO_STYLE = `<style id="seo-style">
:root{color-scheme:light dark}
#root>main *{box-sizing:border-box}
#root>main{max-width:720px;margin:0 auto;padding:24px 18px 64px;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#root>main header a{font-weight:700;text-decoration:none;font-size:18px}
#root>main h1{font-size:26px;line-height:1.2;margin:18px 0 6px}
#root>main h2{font-size:18px;margin:28px 0 8px}
#root>main h3{font-size:15px;margin:16px 0 4px}
#root>main .muted{opacity:.7}
#root>main .cta{display:inline-block;margin:18px 0;padding:11px 18px;border-radius:10px;background:#0a84ff;color:#fff;text-decoration:none;font-weight:600}
#root>main table{border-collapse:collapse;width:100%;margin:8px 0;font-size:15px}
#root>main th,#root>main td{text-align:left;padding:7px 10px;border-bottom:1px solid #8883}
#root>main ul.cards{list-style:none;padding:0;margin:8px 0}
#root>main ul.cards li{padding:12px 0;border-bottom:1px solid #8883}
#root>main ul.cards a{font-weight:600;text-decoration:none}
#root>main ul.areas{list-style:none;padding:0;margin:8px 0;display:flex;flex-wrap:wrap;gap:8px}
#root>main ul.areas a{display:inline-block;padding:6px 12px;border:1px solid #8884;border-radius:999px;text-decoration:none;font-size:14px}
#root>main .est{font-variant-numeric:tabular-nums}
#root>main footer{margin-top:40px;font-size:14px}
</style>`;

type HeadOpts = {
  title: string;
  description: string;
  canonical: string;
  jsonLd?: object | object[];
};

/** The per-page head tags injected between the SEO_HEAD markers (or emitted
 *  inside <head> of the standalone fallback document). */
function composeHead({ title, description, canonical, jsonLd }: HeadOpts): string {
  const ld = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : '';
  return `<title>${escapeHtml(title)}</title>
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
${SEO_STYLE}
${ld}`;
}

/** Wrap the inner crawlable HTML in the <main> + site chrome that goes inside
 *  `#root` (React replaces it on mount). */
function pageBody(inner: string): string {
  return `<main>
<header><a href="/">${SITE_NAME}</a> <span class="muted">· Singapore parking rates</span></header>
${inner}
<footer class="muted">Live availability and turn-by-turn search are in the app. Rates shown are estimates — confirm at the gantry.</footer>
</main>`;
}

/** Complete standalone document — the graceful fallback when the SPA shell
 *  can't be read by the injector. */
function fullDoc(head: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${head}
</head>
<body>
<div id="root">${body}</div>
</body>
</html>`;
}

function buildPage(opts: HeadOpts & { inner: string }): RenderedPage {
  const head = composeHead(opts);
  const body = pageBody(opts.inner);
  return { head, body, html: fullDoc(head, body) };
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

// ─── shared JSON-LD ──────────────────────────────────────────────────────

function breadcrumbLd(
  trail: { name: string; url: string }[],
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: t.url,
    })),
  };
}

function faqLd(qa: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

/** Visible FAQ block (mirrors the FAQPage JSON-LD so the on-page text matches). */
function faqHtml(qa: { q: string; a: string }[]): string {
  const items = qa
    .map(
      ({ q, a }) =>
        `<h3>${escapeHtml(q)}</h3><p class="muted">${escapeHtml(a)}</p>`,
    )
    .join('');
  return `<h2>Frequently asked questions</h2>${items}`;
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
): RenderedPage {
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

  const inner = `
<h1>${escapeHtml(cp.name)}</h1>
<p class="muted">${meta.join(' · ')}</p>
${estimateTable(cp.rates.weekday)}
${rateTable('Weekday rates', cp.rates.weekday)}
${rateTable('Saturday rates', cp.rates.saturday)}
${rateTable('Sunday & public holiday rates', cp.rates.sundayPH)}
${nearbyHtml}
`;

  return buildPage({
    title,
    description,
    canonical,
    inner,
    jsonLd: [
      carparkJsonLd(cp, oneHour),
      breadcrumbLd([
        { name: SITE_NAME, url: `${ORIGIN}/` },
        { name: cp.name, url: canonical },
      ]),
    ],
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

function areaFaq(
  area: SeoArea,
  cheapest: RankedCarpark | undefined,
  count: number,
): { q: string; a: string }[] {
  const cheapName = cheapest?.name;
  const cheapPrice =
    cheapest?.estOneHourCents != null
      ? fmtDollars(cheapest.estOneHourCents)
      : null;
  return [
    {
      q: `How much is parking near ${area.name}?`,
      a:
        cheapPrice && cheapName
          ? `The cheapest carpark we track near ${area.name} is ${cheapName}, from about ${cheapPrice}/hr on a weekday (estimate — confirm at the gantry). wheretopark.sg compares ${count} carparks in the area so you can pick the cheapest.`
          : `wheretopark.sg compares ${count} carparks near ${area.name} with weekday, Saturday and Sunday/PH rates so you can find the cheapest before you drive.`,
    },
    {
      q: `Where can I park cheaply near ${area.name}?`,
      a: `Sort the carpark list above by estimated cost. wheretopark.sg ranks every carpark near ${area.name} cheapest-first using live HDB, URA and LTA rate data.`,
    },
    {
      q: `Which carparks near ${area.name} show live availability?`,
      a: `HDB and many LTA/operator carparks near ${area.name} report live lot counts in the wheretopark.sg app, updated about every minute, so you can see which have free lots before you leave.`,
    },
  ];
}

export function renderAreaPage(
  area: SeoArea,
  carparks: SeoCarpark[],
): RenderedPage {
  const ranked = rankByEstimate(carparks);
  const cheapest = ranked.find((c) => c.estOneHourCents != null);
  const priceBit = cheapest
    ? ` from about ${fmtDollars(cheapest.estOneHourCents as number)}/hr.`
    : '.';
  const title = `Parking near ${area.name} — rates, availability & cheapest carparks | ${SITE_NAME}`;
  const description =
    `Find and compare ${ranked.length} carparks near ${area.name}${priceBit} ` +
    `${area.blurb} Weekday, Saturday and Sunday rates with estimated costs and live availability.`;
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

  const nearby = nearestAreas(area, 6);
  const nearbyLinks = `<h2>Parking in nearby areas</h2><ul class="areas">${nearby
    .map(
      (a) =>
        `<li><a href="/parking-near/${a.slug}">${escapeHtml(a.name)}</a></li>`,
    )
    .join('')}</ul>`;

  const faq = areaFaq(area, cheapest, ranked.length);

  const inner = `
<h1>Parking near ${escapeHtml(area.name)}</h1>
<p>${escapeHtml(area.blurb)}</p>
<h2>${ranked.length} carpark${ranked.length === 1 ? '' : 's'} nearby</h2>
${list}
${faqHtml(faq)}
${nearbyLinks}
`;

  return buildPage({
    title,
    description,
    canonical,
    inner,
    jsonLd: [
      areaJsonLd(area, ranked),
      faqLd(faq),
      breadcrumbLd([
        { name: SITE_NAME, url: `${ORIGIN}/` },
        { name: `Parking near ${area.name}`, url: canonical },
      ]),
    ],
  });
}

// ─── home page ───────────────────────────────────────────────────────────

function homeJsonLd(): object[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${ORIGIN}/`,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${ORIGIN}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: `${ORIGIN}/`,
      logo: OG_IMAGE,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: `${ORIGIN}/`,
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'SGD' },
      areaServed: { '@type': 'Country', name: 'Singapore' },
    },
  ];
}

const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I find the cheapest parking in Singapore?',
    a: 'Search a destination on wheretopark.sg and it ranks nearby carparks cheapest-first, using live HDB, URA and LTA rate data, with an estimated cost for how long you plan to stay.',
  },
  {
    q: 'Does wheretopark.sg show live carpark availability?',
    a: 'Yes. HDB and many LTA/operator carparks report live lot counts, refreshed about every minute, so you can see which carparks have free lots before you drive.',
  },
  {
    q: 'Is wheretopark.sg free?',
    a: 'Yes, wheretopark.sg is a free web app. No sign-up is required to search and compare carpark rates and availability across Singapore.',
  },
];

export function renderHomePage(): RenderedPage {
  const title = `${SITE_NAME} — find cheap parking in Singapore before you leave`;
  const description =
    'Compare Singapore carpark rates and live availability before you drive. ' +
    'wheretopark.sg ranks the cheapest carparks near any destination using live HDB, URA and LTA data.';
  const canonical = `${ORIGIN}/`;

  const areaLinks = `<ul class="areas">${SEO_AREAS.map(
    (a) =>
      `<li><a href="/parking-near/${a.slug}">${escapeHtml(a.name)}</a></li>`,
  ).join('')}</ul>`;

  const inner = `
<h1>Find cheap parking in Singapore before you leave</h1>
<p>Compare carpark rates and live availability across Singapore. ${escapeHtml(
    'wheretopark.sg',
  )} ranks the cheapest carparks near any destination using live HDB, URA and LTA data — so you know where to park before you drive.</p>
<h2>Browse parking by area</h2>
${areaLinks}
${faqHtml(HOME_FAQ)}
`;

  return buildPage({
    title,
    description,
    canonical,
    inner,
    jsonLd: [...homeJsonLd(), faqLd(HOME_FAQ)],
  });
}

// ─── sitemap ─────────────────────────────────────────────────────────────

type SitemapEntry = { loc: string; changefreq: string; priority: string };

export function renderSitemap(
  carparkSlugs: string[],
  areaSlugs: string[],
  lastmod: string,
): string {
  const entries: SitemapEntry[] = [
    { loc: `${ORIGIN}/`, changefreq: 'daily', priority: '1.0' },
  ];
  for (const slug of areaSlugs) {
    entries.push({
      loc: `${ORIGIN}/parking-near/${slug}`,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }
  for (const slug of carparkSlugs) {
    entries.push({
      loc: `${ORIGIN}/carpark/${slug}`,
      changefreq: 'monthly',
      priority: '0.5',
    });
  }
  const body = entries
    .map(
      (e) =>
        `<url><loc>${escapeHtml(e.loc)}</loc><lastmod>${escapeHtml(
          lastmod,
        )}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${
          e.priority
        }</priority></url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}
