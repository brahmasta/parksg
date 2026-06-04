/**
 * Vercel Edge SSR — the home page (`/`).
 *
 * Serves the built SPA shell with crawlable home content injected into `#root`
 * (area links + FAQ) and home structured data (WebSite/Organization/
 * WebApplication + FAQPage) injected into <head>. Non-JS crawlers and LLM bots
 * read the fallback content + internal area links; humans get the live React
 * app, which replaces `#root` on mount.
 */

import { renderHomePage } from './_seo/render';
import { injectShell } from './_seo/shell';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const page = renderHomePage();
  const injected = await injectShell(req, { head: page.head, body: page.body });
  return new Response(injected ?? page.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
