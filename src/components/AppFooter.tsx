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

/** Single source of truth for the feedback destination. */
export const FEEDBACK_URL = 'https://x.com/wheretoparksg';

export function AppFooter() {
  return (
    <footer
      style={{
        marginTop: 18,
        padding: '0 4px',
        fontSize: 10.5,
        color: 'var(--text-3)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: 0.2,
        lineHeight: 1.55,
        textAlign: 'center',
      }}
    >
      <div>Built by Bram, a Singapore driver who tired of circling.</div>
      <div>
        Spotted a wrong rate or a missing carpark?{' '}
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Send feedback on X (@wheretoparksg)"
          style={{
            color: 'var(--accent-on)',
            textDecoration: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Let me know →
        </a>
      </div>
    </footer>
  );
}
