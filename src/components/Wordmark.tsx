export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-brand)',
        fontSize: size,
        fontWeight: 700,
        color: 'var(--text-1)',
        letterSpacing: -0.4,
      }}
    >
      <span
        aria-hidden
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: 10,
          background: 'linear-gradient(145deg, var(--brand) 0%, var(--brand-2) 100%)',
          color: 'var(--brand-on)',
          boxShadow: '0 4px 13px var(--brand-glow)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size,
          fontWeight: 700,
          fontFamily: 'var(--font-brand)',
          flexShrink: 0,
        }}
      >
        P
      </span>
      <span>
        wheretopark<span style={{ color: 'var(--text-3)', fontWeight: 500 }}>.sg</span>
      </span>
    </div>
  );
}
