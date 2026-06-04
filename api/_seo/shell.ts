/**
 * Reads the built SPA shell (`/index.html`) and injects per-route SEO content
 * into it, so a single URL serves crawlable HTML AND boots the live React app.
 *
 * Why fetch `/index.html` instead of `fs.read(dist/index.html)`?  These routes
 * run on the Vercel **Edge** runtime, which has no filesystem. The built shell
 * is a same-origin static asset, so a plain `fetch` retrieves it (it carries the
 * hashed `<script type=module>` + CSS `<link>` Vite emitted). This keeps every
 * SEO route on Edge and works identically under `vercel dev` and in production.
 *
 * The shell is cached in module scope (warm Edge instances reuse it). If the
 * fetch fails or the markers are missing, `injectShell` returns null and the
 * caller falls back to its standalone `htmlShell` document — so routes never
 * 500 and never serve a blank SPA without crawlable content.
 */

const HEAD_RE = /<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/;
const BODY_MARK = '<!--SEO_BODY-->';

let cachedShell: string | null = null;

async function loadShell(origin: string): Promise<string | null> {
  if (cachedShell) return cachedShell;
  try {
    const res = await fetch(`${origin}/index.html`, {
      headers: { 'x-seo-shell': '1' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Guard: only cache a shell we can actually inject into.
    if (!HEAD_RE.test(html) || !html.includes(BODY_MARK)) return null;
    cachedShell = html;
    return html;
  } catch {
    return null;
  }
}

/**
 * Inject `head` (per-page title/meta/JSON-LD) and `body` (crawlable `<main>`)
 * into the built shell. `req` supplies the same-origin to fetch the shell from.
 * Returns null on any failure so the caller can fall back to a standalone doc.
 */
export async function injectShell(
  req: Request,
  parts: { head: string; body: string },
): Promise<string | null> {
  const origin = new URL(req.url).origin;
  const shell = await loadShell(origin);
  if (!shell) return null;
  return shell
    .replace(HEAD_RE, parts.head)
    .replace(BODY_MARK, parts.body);
}
