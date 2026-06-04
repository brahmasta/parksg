/**
 * Vercel Edge SSR — an area landing page ("parking near …").
 *
 * Resolves `/parking-near/:area` (rewritten to `/api/parking-near?area=:area`)
 * to a fully-rendered HTML document listing the carparks near a curated
 * Singapore area, ranked cheapest-first, each linking to its `/carpark/:slug`
 * page. Crawlable without JavaScript.
 */

import { fetchCarparksInBox } from './_seo/db';
import { findArea } from './_seo/areas';
import { renderAreaPage } from './_seo/render';
import { injectShell } from './_seo/shell';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get('area')?.trim();
  if (!slug) return notFound('Missing area.');

  const area = findArea(slug);
  if (!area) return notFound('Unknown area.');

  let carparks: Awaited<ReturnType<typeof fetchCarparksInBox>> = [];
  try {
    carparks = await fetchCarparksInBox(
      { lat: area.lat, lng: area.lng },
      area.radiusM,
    );
  } catch {
    /* render an empty-state page rather than 500 */
  }

  const page = renderAreaPage(area, carparks);
  const injected = await injectShell(req, { head: page.head, body: page.body });
  return new Response(injected ?? page.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}

function notFound(msg: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Not found</title>` +
      `<p>${msg} <a href="/">Go to wheretopark.sg →</a></p>`,
    {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    },
  );
}
