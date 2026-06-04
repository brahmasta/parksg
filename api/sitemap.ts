/**
 * Vercel Edge SSR — sitemap.xml.
 *
 * Resolves `/sitemap.xml` (rewritten to `/api/sitemap`) to a sitemap listing
 * the home page, every curated area page, and every carpark with coordinates.
 */

import { fetchAllCarparkSlugs } from './_seo/db';
import { SEO_AREAS } from './_seo/areas';
import { renderSitemap } from './_seo/render';

export const config = { runtime: 'edge' };

export default async function handler(_req: Request): Promise<Response> {
  let carparkSlugs: string[] = [];
  try {
    carparkSlugs = await fetchAllCarparkSlugs();
  } catch {
    /* still emit a valid sitemap with the home + area pages */
  }
  const areaSlugs = SEO_AREAS.map((a) => a.slug);
  // Stamp lastmod at request time (Edge handler, so Date is allowed here).
  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = renderSitemap(carparkSlugs, areaSlugs, lastmod);
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
