/**
 * Server-side alias for the curated SEO areas. The single source of truth now
 * lives in `src/lib/seoAreas.ts` so the client (path routing + in-app area
 * links) and the server (SSR landing pages + sitemap) stay in lockstep.
 *
 * Re-exported here so the existing `api/*` imports keep working unchanged.
 */

export {
  type SeoArea,
  SEO_AREAS,
  findArea,
  nearestAreas,
} from '../../src/lib/seoAreas';
