export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-display)',
        fontSize: size,
        fontWeight: 700,
        color: 'var(--text-1)',
        letterSpacing: -0.4,
      }}
    >
      <span
        style={{
          width: size + 6,
          height: size + 6,
          borderRadius: 7,
          background: 'var(--accent)',
          color: 'var(--accent-on)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size - 2,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
        }}
      >
        W
      </span>
      <span>
        wheretopark<span style={{ color: 'var(--text-2)', fontWeight: 500 }}>.sg</span>
      </span>
    </div>
  );
}
