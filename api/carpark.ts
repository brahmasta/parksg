/**
 * Vercel Edge SSR — a single carpark landing page.
 *
 * Resolves `/carpark/:slug` (rewritten to `/api/carpark?slug=:slug`) to a
 * fully-rendered HTML document with rates, estimated costs, JSON-LD and an
 * "Open in app" CTA. Crawlable without JavaScript.
 */

import { fetchCarparkBySlug, fetchCarparksInBox } from './_seo/db';
import { renderCarparkPage } from './_seo/render';
import { injectShell } from './_seo/shell';

export const config = { runtime: 'edge' };

const NEARBY_RADIUS_M = 500;
const NEARBY_LIMIT = 6;

export default async function handler(req: Request): Promise<Response> {
  const slug = new URL(req.url).searchParams.get('slug')?.trim();
  if (!slug) return notFound('Missing carpark slug.');

  const cp = await fetchCarparkBySlug(slug);
  if (!cp) return notFound('Carpark not found.');

  // Best-effort nearby list for internal linking. Never block the page on it.
  let nearby: Awaited<ReturnType<typeof fetchCarparksInBox>> = [];
  try {
    nearby = (await fetchCarparksInBox({ lat: cp.lat, lng: cp.lng }, NEARBY_RADIUS_M))
      .filter((c) => c.slug !== cp.slug)
      .slice(0, NEARBY_LIMIT);
  } catch {
    /* nearby is decorative — ignore failures */
  }

  const page = renderCarparkPage(cp, nearby);
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
