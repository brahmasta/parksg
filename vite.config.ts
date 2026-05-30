import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

// In local dev, mount /api/<name> on the Vite server so the Vercel Edge
// functions in /api can run without `vercel dev`. Reads env vars from
// .env / .env.local the same way Vite already does for the client.
// Rewrite the pretty SEO URLs to their /api handler + query string, mirroring
// the production vercel.json rewrites. Returns the input unchanged for any
// path that isn't an SEO route.
function seoRewrite(rawUrl: string): string {
  const [pathOnly] = rawUrl.split('?')
  const cp = pathOnly.match(/^\/carpark\/([^/]+)\/?$/)
  if (cp) return `/api/carpark?slug=${encodeURIComponent(decodeURIComponent(cp[1]))}`
  const area = pathOnly.match(/^\/parking-near\/([^/]+)\/?$/)
  if (area) return `/api/parking-near?area=${encodeURIComponent(decodeURIComponent(area[1]))}`
  if (pathOnly === '/sitemap.xml') return '/api/sitemap'
  return rawUrl
}

function localVercelApi(env: Record<string, string>): Plugin {
  return {
    name: 'local-vercel-api',
    configureServer(server: ViteDevServer) {
      // Make .env.local values visible to the handlers via process.env.
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] == null) process.env[k] = v
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        // Map the pretty SEO routes to their edge handlers in dev. Production
        // does this with vercel.json rewrites; here we do it by hand so a
        // plain `npm run dev` can serve /carpark/:slug etc.
        const rawUrl = seoRewrite(req.url ?? '')
        if (!rawUrl.startsWith('/api/')) return next()

        const [pathOnly] = rawUrl.split('?')
        const name = pathOnly.slice('/api/'.length)
        if (!name || name.includes('/')) return next()

        const filePath = resolve(__dirname, 'api', `${name}.ts`)
        if (!existsSync(filePath)) return next()

        try {
          const mod = await server.ssrLoadModule(filePath)
          const handler = mod.default
          if (typeof handler !== 'function') {
            res.statusCode = 500
            res.end(`/api/${name}: no default export`)
            return
          }

          // Build a Web Request from the Node IncomingMessage.
          const host = req.headers.host ?? 'localhost'
          const url = `http://${host}${rawUrl}`
          const init: RequestInit = {
            method: req.method ?? 'GET',
            headers: Object.fromEntries(
              Object.entries(req.headers).map(([k, v]) => [
                k,
                Array.isArray(v) ? v.join(', ') : (v ?? ''),
              ]),
            ),
          }
          if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const c of req) chunks.push(c as Buffer)
            init.body = Buffer.concat(chunks)
          }

          const response: Response = await handler(new Request(url, init))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          const buf = Buffer.from(await response.arrayBuffer())
          res.end(buf)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[local-vercel-api] /api/${name} failed:`, err)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({
            ok: false,
            error: 'local-vercel-api handler threw',
            detail: err instanceof Error ? err.message : String(err),
          }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load .env and .env.local with no prefix filter so server-side keys
  // (GOOGLE_PLACES_API_KEY, LTA_ACCOUNT_KEY, ...) come through.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), localVercelApi(env)],
  }
})
