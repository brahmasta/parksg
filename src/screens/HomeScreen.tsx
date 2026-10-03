import { useMemo, type CSSProperties } from 'react';
import type {
  MergedSaveItem,
  RecentDestination,
  User,
} from '../lib/types';
import { AppFooter } from '../components/AppFooter';
import { PlaceAutocomplete } from '../components/PlaceAutocomplete';
import type { ResolvedPlace } from '../lib/api/googlePlaces';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { Wordmark } from '../components/Wordmark';
import { pickHeroCopy } from '../lib/heroCopy';
import { HomeRecentSection, HomeSavedSection } from '../components/HomeSections';
import {
  IconInfo,
  IconLocation,
  IconUser,
} from '../components/icons';

const topBarIconBtn: CSSProperties = {
  appearance: 'none',
  width: 36,
  height: 36,
  borderRadius: 999,
  background: 'var(--bg-1)',
  border: '0.5px solid var(--line-strong)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export function HomeScreen({
  destination,
  setDestination,
  onSearch,
  onPickPlace,
  onNearMe,
  recents,
  nearMeBusy,
  user,
  onOpenAccount,
  onOpenAbout,
  merged,
  onOpenSaved,
  onSearchSavedDestination,
  onOpenSavedCarpark,
}: {
  destination: string;
  setDestination: (v: string) => void;
  onSearch: (q?: string) => void;
  onPickPlace: (place: ResolvedPlace) => void;
  onNearMe: () => void;
  recents: RecentDestination[];
  nearMeBusy?: boolean;
  user: User | null;
  onOpenAccount: () => void;
  onOpenAbout: () => void;
  /** Merged Saved feed, latest-first. */
  merged: MergedSaveItem[];
  onOpenSaved: () => void;
  onSearchSavedDestination: (
    item: MergedSaveItem & { kind: 'destination' },
  ) => void;
  onOpenSavedCarpark: (
    item: MergedSaveItem & { kind: 'carpark' },
  ) => void;
}) {
  // Pick one hero variant per mount and lock it in — no churn while the
  // user is on the screen. Random on each fresh app load.
  const hero = useMemo(() => pickHeroCopy(), []);

  return (
    <div
      className="psg-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: 'var(--screen-top) 16px 12px',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Wordmark size={19} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onOpenAbout}
            aria-label="About"
            data-track="nav_about"
            style={topBarIconBtn}
          >
            <IconInfo size={16} stroke={2} style={{ color: 'var(--text-2)' }} />
          </button>
          <ThemeToggleButton />
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Account"
            data-track="nav_account"
            style={{
              appearance: 'none',
              width: 36,
              height: 36,
              borderRadius: 999,
              background: user ? 'var(--bg-1)' : 'var(--bg-2)',
              border: '0.5px solid var(--line-strong)',
              color: 'var(--text-1)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {user ? (
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: -0.2,
                }}
              >
                {user.initials}
              </span>
            ) : (
              <IconUser
                size={17}
                stroke={1.75}
                style={{ color: 'var(--text-2)' }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px', position: 'relative' }}>
        {/* Hero copy */}
        <div style={{ paddingTop: 28, paddingBottom: 18 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 34,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.8,
              lineHeight: 1.05,
              textWrap: 'balance',
            }}
          >
            {hero.header}
          </h1>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 14,
              color: 'var(--text-2)',
              lineHeight: 1.45,
              maxWidth: 340,
            }}
          >
            {hero.sub}
          </p>
        </div>

        {/* Search */}
        <PlaceAutocomplete
          value={destination}
          onChange={setDestination}
          onSubmitText={onSearch}
          onPickPlace={onPickPlace}
          placeholder="Search destination, mall or postcode"
        />

        {/* Near-me */}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button
            onClick={onNearMe}
            disabled={nearMeBusy}
            data-track="search_near_me"
            style={{
              appearance: 'none',
              flex: 1,
              padding: '12px 14px',
              background: 'var(--bg-2)',
              border: '0.5px solid var(--line-strong)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: 'var(--text-1)',
              fontSize: 14,
              fontWeight: 500,
              cursor: nearMeBusy ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              minHeight: 44,
              opacity: nearMeBusy ? 0.6 : 1,
            }}
          >
            <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
              <IconLocation size={16} stroke={2} />
            </span>
            {nearMeBusy ? 'Finding your location…' : 'Use my location'}
          </button>
        </div>

        <HomeSavedSection
          merged={merged}
          onOpenSaved={onOpenSaved}
          onSearchSavedDestination={onSearchSavedDestination}
          onOpenSavedCarpark={onOpenSavedCarpark}
        />

        <HomeRecentSection
          recents={recents}
          user={user}
          setDestination={setDestination}
          onSearch={onSearch}
          onPickPlace={onPickPlace}
          onOpenAccount={onOpenAccount}
        />

        <AppFooter user={user} />
      </div>
    </div>
  );
}
