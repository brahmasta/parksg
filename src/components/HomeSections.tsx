import { useState, type ReactNode } from 'react';
import type { MergedSaveItem, RecentDestination, User } from '../lib/types';
import type { ResolvedPlace } from '../lib/api/googlePlaces';
import { HomeSavedDestChip } from './HomeSavedDestChip';
import { HomeSavedCarparkChip } from './HomeSavedCarparkChip';
import {
  IconBookmark,
  IconCloud,
  IconGoogleG,
  IconHistory,
  IconPin,
} from './icons';

// Saved + Recent sections of the pre-search home. Shared by the phone
// HomeScreen and the desktop landing so the two stay identical.

export function HomeSavedSection({
  merged,
  onOpenSaved,
  onSearchSavedDestination,
  onOpenSavedCarpark,
}: {
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
  return (
    <>
        {/* Merged Saved chip strip — destinations + carparks, latest-first.
            Capped at 8; tap a chip → either a destination search or a Detail
            view, depending on item kind. Saves persist locally, so this shows
            whether or not the user is signed in. */}
        {merged.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader
              icon={
                <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                  <IconBookmark filled size={14} stroke={2} />
                </span>
              }
              label="Saved"
              link={
                <span data-track="nav_saved" style={{ display: 'inline-flex' }}>
                  <SectionLink color="var(--accent)" onClick={onOpenSaved}>
                    View all
                  </SectionLink>
                </span>
              }
            />
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
              {merged.slice(0, 8).map((item) =>
                item.kind === 'destination' ? (
                  <HomeSavedDestChip
                    key={`d-${item.id}`}
                    d={item.destination}
                    onClick={() => onSearchSavedDestination(item)}
                  />
                ) : (
                  <HomeSavedCarparkChip
                    key={`c-${item.id}`}
                    cp={item.carpark}
                    onClick={() => onOpenSavedCarpark(item)}
                  />
                ),
              )}
            </div>
          </div>
        )}
    </>
  );
}

export function HomeRecentSection({
  recents,
  user,
  setDestination,
  onSearch,
  onPickPlace,
  onOpenAccount,
}: {
  recents: RecentDestination[];
  user: User | null;
  setDestination: (v: string) => void;
  onSearch: (q?: string) => void;
  onPickPlace: (place: ResolvedPlace) => void;
  onOpenAccount: () => void;
}) {
  // Recent list shows the freshest 3 by default; "See all" reveals the rest.
  const [recentsExpanded, setRecentsExpanded] = useState(false);

  return (
    <>
        {/* Recent — persisted locally on the device, so it shows whether or not
            the user is signed in. The label notes sync state; signed-out users
            with recents get a slim nudge to sync. A signed-out user with no
            recents instead sees the full sync upsell card below. */}
        {recents.length > 0 ? (
          <div style={{ marginTop: 22 }}>
            <SectionHeader
              icon={
                <span style={{ color: 'var(--text-2)', display: 'inline-flex' }}>
                  <IconHistory size={14} stroke={2} />
                </span>
              }
              label={user ? 'Recent · synced' : 'Recent'}
              link={
                <span data-track="recents_see_all" style={{ display: 'inline-flex' }}>
                  <SectionLink
                    color="var(--text-3)"
                    onClick={() => setRecentsExpanded((v) => !v)}
                  >
                    See all
                  </SectionLink>
                </span>
              }
            />
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
              {(recentsExpanded ? recents : recents.slice(0, 3)).map((r, i) => (
                <RecentRow
                  key={r.name}
                  r={r}
                  isFirst={i === 0}
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
            {!user && (
              <button
                type="button"
                onClick={onOpenAccount}
                data-track="sign_in"
                style={{
                  appearance: 'none',
                  border: '0.5px solid var(--line)',
                  width: '100%',
                  marginTop: 8,
                  padding: '9px 12px',
                  background: 'var(--bg-1)',
                  color: 'var(--text-2)',
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                  <IconCloud size={14} stroke={1.75} />
                </span>
                Sign in to sync recents across devices
              </button>
            )}
          </div>
        ) : !user ? (
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
                data-track="sign_in"
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
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <IconGoogleG size={16} />
                Continue with Google
              </button>
            </div>
          </div>
        ) : null}
    </>
  );
}

function RecentRow({
  r,
  isFirst,
  onClick,
}: {
  r: RecentDestination;
  isFirst: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-track="recent_dest_chip"
      style={{
        appearance: 'none',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 14px',
        background: 'transparent',
        border: 0,
        borderTop: isFirst ? 'none' : '0.5px solid var(--line)',
        color: 'var(--text-1)',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0 }}>
        <IconPin size={12} stroke={2} />
      </span>
      {/* Name + meta on one baseline-aligned row; name takes width priority. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: 'var(--text-1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {r.name}
        </span>
        {r.hint && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 0.1,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '45%',
            }}
          >
            {r.hint}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Shared section header pieces (Saved + Recent are peers) ──────────
function SectionHeader({
  icon,
  label,
  link,
}: {
  icon: ReactNode;
  label: string;
  link: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: 'var(--text-2)',
          }}
        >
          {label}
        </span>
      </div>
      {link}
    </div>
  );
}

function SectionLink({
  color,
  onClick,
  children,
}: {
  color: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 0,
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </button>
  );
}
