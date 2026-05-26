/**
 * Global app footer — sits at the bottom of every screen's scrollable
 * body. Two lines of mono micro-copy: a credit line and a feedback CTA
 * linking to the project's X / Twitter handle.
 *
 * Kept small (10.5pt mono) so it never competes with the data-freshness
 * notes that sit just above it on Results / Detail.
 */
export function AppFooter() {
  return (
    <div
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
          href="https://x.com/wheretoparksg"
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
    </div>
  );
}
