import { isNative } from '../lib/platform';

/**
 * Home-screen invitation to the 3D map preview (the static page in
 * public/beta/). A plain link, so it is a full page load that leaves the app
 * shell: on the web to /beta, in the Android and iOS apps to the copy of the
 * page bundled with the app (the WebView serves the app shell for any path
 * that is not a file, so the file is named in full there). The page has its
 * own link back.
 */
export function BetaInvite() {
  return (
    <a
      href={isNative ? '/beta/index.html' : '/beta'}
      data-track="beta_open"
      style={{
        marginTop: 10,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        minHeight: 44,
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line-strong)',
        borderRadius: 12,
        color: 'var(--text-1)',
        textDecoration: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'var(--bg-2)',
          color: 'var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l8 4.5v9L12 21l-8-4.500v-9z" />
          <path d="M4 7.500l8 4.500 8-4.500M12 12v9" />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600 }}>
          Try the 3D map
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              padding: '2px 6px',
              borderRadius: 6,
              background: 'var(--bg-2)',
              color: 'var(--text-2)',
            }}
          >
            Beta
          </span>
        </span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.35 }}>
          The same prices and free lots on a toy map of Singapore.
        </span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}
