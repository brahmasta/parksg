// Mandatory "Powered by Google" attribution, shown wherever supplementary
// Google Places data is rendered (Results footer + Detail). Mirrors the muted
// attribution footer used by EVSection for the LTA EV data.

export function PoweredByGoogle({ note }: { note?: string }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: '0 4px',
        fontSize: 10.5,
        color: 'var(--text-3)',
        lineHeight: 1.5,
        fontFamily: 'var(--font-mono)',
        letterSpacing: 0.2,
      }}
    >
      Powered by Google{note ? ` · ${note}` : ''}
    </div>
  );
}
