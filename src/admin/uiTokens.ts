/**
 * Shared style tokens for the /admin dashboard.
 *
 * Extracted from AdminDashboard so the traffic audit renders in the same
 * visual language rather than carrying a second, drifting copy of the type
 * scale and card treatments.
 */

/* ── Type scale (one deliberate ladder, used everywhere below) ───────────── */
export const TYPE = {
  hero: { fontSize: 32, fontWeight: 700, letterSpacing: -1, lineHeight: 1 } as React.CSSProperties,
  metric: { fontSize: 22, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1 } as React.CSSProperties,
  total: { fontSize: 26, fontWeight: 700, letterSpacing: -0.6, lineHeight: 1 } as React.CSSProperties,
  caption: { fontSize: 11.5, fontWeight: 500 } as React.CSSProperties,
};

export const card: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '0.5px solid var(--line-strong)',
  borderRadius: 14,
  padding: 20,
  boxShadow: 'var(--shadow-card)',
};

/* Breakdowns sit one tier down: lighter elevation + tighter padding. */
export const cardSoft: React.CSSProperties = {
  ...card,
  padding: 16,
  boxShadow: 'var(--shadow-sm)',
};

export const eyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-3)',
  marginBottom: 12,
};

export const selectStyle: React.CSSProperties = {
  appearance: 'none',
  padding: '8px 12px',
  borderRadius: 10,
  border: '0.5px solid var(--line-strong)',
  background: 'var(--bg-1)',
  color: 'var(--text-1)',
  fontSize: 13,
  cursor: 'pointer',
};

export const statLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
  fontFamily: 'var(--font-mono)',
};

