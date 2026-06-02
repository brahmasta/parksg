import { useState, type CSSProperties } from 'react';
import type { User } from '../lib/types';
import { Wordmark } from '../components/atoms';
import { IconInfo, IconUser } from '../components/icons';
import { FindParkingDesktop, type FindParkingDesktopProps } from './FindParkingDesktop';
import { CoverageScreen } from '../screens/CoverageScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { AccountScreen } from '../screens/AccountScreen';

type DesktopRoute = 'find' | 'coverage' | 'about' | 'account';

export type DesktopShellProps = {
  find: FindParkingDesktopProps;
  user: User | null;
  savedItemCount: number;
  onSignIn: () => void;
  onRequestSignOut: () => void;
};

/**
 * Desktop/tablet shell (≥960px): a sticky top nav over a routed content area.
 * Find parking is a two-pane view; Coverage/About/Account are peer routes.
 * All data + handlers are shared with the phone flow (passed down from App).
 */
export function DesktopShell({ find, user, savedItemCount, onSignIn, onRequestSignOut }: DesktopShellProps) {
  const [route, setRoute] = useState<DesktopRoute>('find');

  return (
    <div className="psg" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)', color: 'var(--text-1)' }}>
      <TopNav route={route} setRoute={setRoute} user={user} />

      {route === 'find' && <FindParkingDesktop {...find} />}

      {route === 'coverage' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <CoverageScreen onFindParking={() => setRoute('find')} />
        </div>
      )}

      {route === 'about' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <AboutScreen onBack={() => setRoute('find')} onStartSearch={() => setRoute('find')} />
        </div>
      )}

      {route === 'account' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <AccountScreen
            user={user}
            savedItemCount={savedItemCount}
            onBack={() => setRoute('find')}
            onSignIn={onSignIn}
            onOpenSaved={() => setRoute('find')}
            onRequestSignOut={onRequestSignOut}
          />
        </div>
      )}
    </div>
  );
}

const circleBtn: CSSProperties = {
  appearance: 'none',
  width: 34,
  height: 34,
  borderRadius: 999,
  background: 'transparent',
  border: '0.5px solid var(--line-strong)',
  color: 'var(--text-2)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

function TopNav({ route, setRoute, user }: { route: DesktopRoute; setRoute: (r: DesktopRoute) => void; user: User | null }) {
  const links: [DesktopRoute, string][] = [
    ['find', 'Find parking'],
    ['coverage', 'Coverage'],
    ['about', 'About'],
  ];
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 64,
        background: 'color-mix(in srgb, var(--bg-0) 88%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid var(--line-strong)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <button onClick={() => setRoute('find')} aria-label="wheretopark.sg home" style={{ appearance: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}>
          <Wordmark size={19} />
        </button>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {links.map(([key, label]) => {
            const active = route === key;
            return (
              <button
                key={key}
                onClick={() => setRoute(key)}
                aria-current={active ? 'page' : undefined}
                style={{
                  appearance: 'none',
                  border: 0,
                  background: active ? 'var(--bg-1)' : 'transparent',
                  color: active ? 'var(--text-1)' : 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  padding: '8px 14px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  boxShadow: active ? 'inset 0 0 0 0.5px var(--line-strong)' : 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button aria-label="About" onClick={() => setRoute('about')} style={circleBtn}>
          <IconInfo size={17} stroke={2} />
        </button>
        <button
          aria-label="Account"
          onClick={() => setRoute('account')}
          style={{
            ...circleBtn,
            width: 36,
            height: 36,
            background: route === 'account' ? 'var(--accent-tint)' : 'var(--bg-1)',
            border: route === 'account' ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
            color: 'var(--text-1)',
          }}
        >
          {user ? (
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, letterSpacing: -0.2 }}>{user.initials}</span>
          ) : (
            <IconUser size={17} stroke={1.75} style={{ color: 'var(--text-2)' }} />
          )}
        </button>
      </div>
    </header>
  );
}
