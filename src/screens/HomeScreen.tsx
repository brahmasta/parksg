import { useMemo } from 'react';
import type { RecentDestination, SavedDestination, User } from '../lib/types';
import { AppFooter } from '../components/AppFooter';
import { PlaceAutocomplete } from '../components/PlaceAutocomplete';
import type { ResolvedPlace } from '../lib/api/googlePlaces';
import { Wordmark } from '../components/Wordmark';
import { pickHeroCopy } from '../lib/heroCopy';
import { DestinationIcon } from '../components/DestinationIcon';
import {
  IconBookmark,
  IconChevronRight,
  IconCloud,
  IconGoogleG,
  IconHistory,
  IconInfo,
  IconLocation,
  IconPin,
  IconUser,
} from '../components/icons';

export function HomeScreen({
  destination,
  setDestination,
  onSearch,
  onPickPlace,
  onNearMe,
  recents,
  nearMeBusy,
  onAbout,
  user,
  onOpenAccount,
  savedDestinations,
  onOpenSavedDestinations,
  onSearchSavedDestination,
}: {
  destination: string;
  setDestination: (v: string) => void;
  onSearch: (q?: string) => void;
  onPickPlace: (place: ResolvedPlace) => void;
  onNearMe: () => void;
  recents: RecentDestination[];
  nearMeBusy?: boolean;
  onAbout: () => void;
  user: User | null;
  onOpenAccount: () => void;
  savedDestinations: SavedDestination[];
  onOpenSavedDestinations: () => void;
  onSearchSavedDestination: (d: SavedDestination) => void;
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
      {/* Background grid + roads + P-pins (decorative) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.5,
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice">
          <defs>
            <pattern id="psgHomeGrid" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M34 0 H0 V34" fill="none" stroke="var(--line)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="psgHomeFade" cx="50%" cy="0%" r="80%">
              <stop offset="0%" stopColor="var(--bg-0)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--bg-0)" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#psgHomeGrid)" />
          <path d="M-20 220 Q 120 200 200 240 T 420 220" stroke="var(--bg-2)" strokeWidth="22" fill="none" />
          <path d="M-20 460 Q 150 440 230 480 T 420 470" stroke="var(--bg-2)" strokeWidth="14" fill="none" />
          <path d="M80 -20 Q 100 200 90 400 T 90 880" stroke="var(--bg-2)" strokeWidth="12" fill="none" />
          <path d="M310 -20 Q 320 200 300 400 T 300 880" stroke="var(--bg-2)" strokeWidth="14" fill="none" />
          {[
            [55, 320],
            [180, 180],
            [240, 360],
            [330, 280],
            [120, 510],
            [280, 600],
            [55, 700],
          ].map(([cx, cy], i) => (
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <circle r="7" fill="var(--bg-1)" stroke="var(--line-strong)" strokeWidth="1" />
              <text
                textAnchor="middle"
                y="3"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 600 }}
                fill="var(--text-3)"
              >
                P
              </text>
            </g>
          ))}
          <rect width="100%" height="100%" fill="url(#psgHomeFade)" />
        </svg>
      </div>

      {/* Top bar */}
      <div
        style={{
          padding: '52px 16px 12px',
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
            onClick={onAbout}
            aria-label="About"
            style={{
              appearance: 'none',
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'transparent',
              border: '0.5px solid var(--line-strong)',
              color: 'var(--text-2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconInfo size={16} stroke={2} />
          </button>
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Account"
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

        {/* Saved destinations chip strip — signed in & populated */}
        {user && savedDestinations.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{ color: 'var(--accent)', display: 'inline-flex' }}
                >
                  <IconBookmark filled size={11} stroke={1.75} />
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    color: 'var(--text-3)',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  Saved
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenSavedDestinations}
                style={{
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 0.4,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Edit
              </button>
            </div>
            <div
              className="psg-no-scrollbar"
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 2,
                marginLeft: -16,
                paddingLeft: 16,
                marginRight: -16,
                paddingRight: 16,
              }}
            >
              {savedDestinations.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSearchSavedDestination(d)}
                  style={{
                    appearance: 'none',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px 10px 12px',
                    background: 'var(--bg-1)',
                    border: '0.5px solid var(--line-strong)',
                    borderRadius: 999,
                    color: 'var(--text-1)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: 'var(--accent-tint)',
                      color: 'var(--accent)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DestinationIcon name={d.icon} size={12} />
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      letterSpacing: -0.1,
                    }}
                  >
                    {d.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent — signed-in shows synced recents; signed-out shows a sync prompt. */}
        {user ? (
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
              }}
            >
              <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
                <IconHistory size={13} stroke={2} />
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  color: 'var(--text-3)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Recent · synced
              </span>
            </div>
            {recents.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                  background: 'var(--bg-1)',
                  border: '0.5px solid var(--line)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                {recents.map((r, i) => (
                  <RecentRow
                    key={r.name}
                    r={r}
                    isFirst={i === 0}
                    showDevice
                    onClick={() => {
                      if (
                        typeof r.lat === 'number' &&
                        typeof r.lng === 'number'
                      ) {
                        onPickPlace({
                          label: r.name,
                          address: r.address ?? r.name,
                          lat: r.lat,
                          lng: r.lng,
                        });
                      } else {
                        setDestination(r.name);
                        onSearch(r.name);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
              }}
            >
              <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
                <IconHistory size={13} stroke={2} />
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  color: 'var(--text-3)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Recent
              </span>
            </div>
            <div
              style={{
                background: 'var(--bg-1)',
                border: '0.5px solid var(--line)',
                borderRadius: 14,
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: 'var(--accent-tint)',
                    color: 'var(--accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconCloud size={17} stroke={1.75} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                      letterSpacing: -0.2,
                      lineHeight: 1.25,
                    }}
                  >
                    Sign in to sync your recents
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-2)',
                      marginTop: 3,
                      lineHeight: 1.45,
                    }}
                  >
                    Pick up where you left off on any device, save carparks,
                    and one-tap to favourites like Office or Mum's place.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAccount}
                style={{
                  appearance: 'none',
                  border: 0,
                  width: '100%',
                  padding: '11px 14px',
                  background: 'var(--accent)',
                  color: 'var(--accent-on)',
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  boxShadow: '0 6px 14px rgba(46,227,194,0.18)',
                }}
              >
                <IconGoogleG size={16} />
                Continue with Google
              </button>
            </div>
          </div>
        )}

        <AppFooter />
      </div>
    </div>
  );
}

function RecentRow({
  r,
  isFirst,
  showDevice,
  onClick,
}: {
  r: RecentDestination;
  isFirst: boolean;
  showDevice: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        background: 'transparent',
        border: 0,
        borderTop: isFirst ? 'none' : '0.5px solid var(--line)',
        color: 'var(--text-1)',
        cursor: 'pointer',
        minHeight: 44,
        width: '100%',
      }}
    >
      <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}>
        <IconPin size={15} stroke={2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-3)',
            marginTop: 1,
            fontFamily: showDevice ? 'var(--font-mono)' : 'var(--font-body)',
            letterSpacing: showDevice ? 0.1 : 0,
          }}
        >
          {r.hint}
        </div>
      </div>
      <IconChevronRight
        size={14}
        stroke={2}
        style={{ color: 'var(--text-3)' }}
      />
    </button>
  );
}
