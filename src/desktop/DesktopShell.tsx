import { useState, type CSSProperties } from 'react';
import type { MergedSaveItem, User } from '../lib/types';
import { Wordmark } from '../components/atoms';
import { IconInfo, IconUser } from '../components/icons';
import { FindParkingDesktop, type FindParkingDesktopProps } from './FindParkingDesktop';
import { CoverageScreen } from '../screens/CoverageScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { AboutDesktop } from './AboutDesktop';
import { AccountDesktop } from './AccountDesktop';

type DesktopRoute = 'find' | 'saved' | 'coverage' | 'about' | 'account';

export type DesktopSavedProps = {
  merged: MergedSaveItem[];
  destinationCount: number;
  carparkCount: number;
  onSearchDestination: (item: MergedSaveItem & { kind: 'destination' }) => void;
  onOpenCarpark: (item: MergedSaveItem & { kind: 'carpark' }) => void;
  onRemoveDestination: (id: string) => void;
  onUnsaveCarpark: (id: string) => void;
  onAddDestination: () => void;
};

export type DesktopShellProps = {
  find: FindParkingDesktopProps;
  saved: DesktopSavedProps;
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
export function DesktopShell({ find, saved, user, savedItemCount, onSignIn, onRequestSignOut }: DesktopShellProps) {
  const [route, setRoute] = useState<DesktopRoute>('find');

  return (
    <div className="psg" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)', color: 'var(--text-1)' }}>
      <TopNav route={route} setRoute={setRoute} user={user} />

      {route === 'find' && <FindParkingDesktop {...find} />}

      {route === 'saved' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <SavedScreen
              merged={saved.merged}
              destinationCount={saved.destinationCount}
              carparkCount={saved.carparkCount}
              onBack={() => setRoute('find')}
              onSearchDestination={(item) => {
                saved.onSearchDestination(item);
                setRoute('find');
              }}
              onOpenCarpark={(item) => {
                saved.onOpenCarpark(item);
                setRoute('find');
              }}
              onRemoveDestination={saved.onRemoveDestination}
              onUnsaveCarpark={saved.onUnsaveCarpark}
              onAddDestination={saved.onAddDestination}
              onGoFindCarpark={() => setRoute('find')}
            />
          </div>
        </div>
      )}

      {route === 'coverage' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <CoverageScreen onFindParking={() => setRoute('find')} />
        </div>
      )}

      {route === 'about' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <AboutDesktop onFindParking={() => setRoute('find')} onCoverage={() => setRoute('coverage')} />
        </div>
      )}

      {route === 'account' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <AccountDesktop
            user={user}
            savedItemCount={savedItemCount}
            onSignIn={onSignIn}
            onOpenSaved={() => setRoute('saved')}
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
    ['saved', 'Saved'],
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
