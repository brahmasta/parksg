/**
 * Global app footer — sits at the bottom of every screen's scrollable
 * body. Two lines of mono micro-copy: a credit line and a feedback CTA
 * linking to the project's X handle.
 *
 * Kept small (10.5pt mono) so it never competes with the data-freshness
 * notes that sit just above it on Results / Detail. On Detail it lives
 * inside the scroll region, above the 120px gutter the sticky Navigate
 * CTA pins to, so scrolling reveals it fully and the CTA never covers
 * it.
 */

import type { User } from '../lib/types';
import { AddCarparkLink } from './AddCarparkLink';

/** Single source of truth for the feedback destination. */
export const FEEDBACK_URL = 'https://x.com/wheretoparksg';

export function AppFooter({ user = null }: { user?: User | null }) {
  return (
    <footer
      style={{
        marginTop: 18,
        padding: '0 4px',
        fontSize: 10,
        color: 'var(--text-3)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.6,
        textAlign: 'center',
      }}
    >
      Missing a carpark?{' '}
      <AddCarparkLink user={user} variant="modal" label="Add it →" style={{ fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }} />
      {'  ·  '}
      Spotted a wrong rate?{' '}
      <a
        href={FEEDBACK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Send feedback on X (@wheretoparksg)"
        style={{
          color: 'var(--ok)',
          textDecoration: 'none',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Let me know →
      </a>
    </footer>
  );
}
