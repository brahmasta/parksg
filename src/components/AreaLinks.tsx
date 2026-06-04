/**
 * "Browse parking by area" — real `<a href="/parking-near/:slug">` links
 * rendered in the live app (mobile Home + desktop landing).
 *
 * Two jobs:
 *  1. SEO — they put genuine internal links to the area landing pages into the
 *     app's *rendered* DOM, so Google's crawler discovers and weights them.
 *  2. UX — clicking one lands the user on the live results for that area. When
 *     `onPick` is provided we intercept the click and route in-app (no reload);
 *     the href stays intact so crawlers, middle-click and "open in new tab"
 *     still work, and so the link is a real link.
 */

import { SEO_AREAS, type SeoArea } from '../lib/seoAreas';

type Props = {
  /** In-app handler — preventDefault + route to live results without a reload. */
  onPick?: (area: SeoArea) => void;
  /** Limit the number of chips shown (default: all). */
  limit?: number;
  style?: React.CSSProperties;
};

export function AreaLinks({ onPick, limit, style }: Props) {
  const areas = limit ? SEO_AREAS.slice(0, limit) : SEO_AREAS;
  return (
    <nav aria-label="Browse parking by area" style={{ marginTop: 22, ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: 'var(--text-2)',
          }}
        >
          Browse parking by area
        </span>
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {areas.map((area) => (
          <li key={area.slug}>
            <a
              href={`/parking-near/${area.slug}`}
              onClick={(e) => {
                if (!onPick) return;
                // Let modified clicks (new tab / download) behave natively.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onPick(area);
              }}
              style={{
                display: 'inline-block',
                padding: '7px 13px',
                background: 'var(--bg-1)',
                border: '0.5px solid var(--line-strong)',
                borderRadius: 999,
                color: 'var(--text-1)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {area.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
