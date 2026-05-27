import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Analytics, track } from '@vercel/analytics/react';
import type {
  Carpark,
  DurationHours,
  MergedSaveItem,
  RecentDestination,
  SavedDestination,
  Screen,
  ViewMode,
} from './lib/types';
import { HomeScreen } from './screens/HomeScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { AboutScreen } from './screens/AboutScreen';
import { AccountScreen } from './screens/AccountScreen';
import { SavedScreen } from './screens/SavedScreen';
import {
  IconBookmark,
  IconCheck,
  IconNavigate,
  IconSignOut,
  IconTrash,
  IconWarning,
} from './components/icons';
import { useCarparks } from './hooks/useCarparks';
import { loadRecents, pushRecent } from './lib/recents';
import { useSession } from './lib/auth';
import { snapshotFromCarpark, useSaves } from './lib/saves';
import { SignOutSheet } from './components/SignOutSheet';
import { AddDestSheet, type AddDestPrefill } from './components/AddDestSheet';
import { Toast, useToast } from './components/Toast';

const DURATION_KEY = 'psg.duration';
const VIEW_MODE_KEY = 'psg.viewMode';
const AVAILABLE_ONLY_KEY = 'psg.availableOnly';
const EV_ONLY_KEY = 'psg.evOnly';

function readStored<T>(key: string, fallback: T, parse: (raw: string) => T | null): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [destinationInput, setDestinationInput] = useState<string>('');

  // Vercel Analytics — fire a custom event on every screen change. The
  // app is a single-page state-machine router so the URL never changes;
  // tracking screen transitions as events lets us see the home → results
  // → detail funnel in the Vercel dashboard. In dev this logs to the
  // console and never leaves the browser.
  useEffect(() => {
    track('screen_view', { screen });
  }, [screen]);

  const [duration, setDurationState] = useState<DurationHours>(() =>
    readStored<DurationHours>(DURATION_KEY, 1, (raw) => {
      const n = Number(raw);
      const allowed: DurationHours[] = [0.5, 1, 1.5, 2, 3, 4];
      return allowed.includes(n as DurationHours) ? (n as DurationHours) : null;
    }),
  );
  const setDuration = useCallback((v: DurationHours) => {
    setDurationState(v);
    try {
      localStorage.setItem(DURATION_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const [viewMode, setViewModeState] = useState<ViewMode>(() =>
    readStored<ViewMode>(VIEW_MODE_KEY, 'list', (raw) =>
      raw === 'list' || raw === 'map' ? raw : null,
    ),
  );
  const setViewMode = useCallback((v: ViewMode) => {
    setViewModeState(v);
    try {
      localStorage.setItem(VIEW_MODE_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  const [availableOnly, setAvailableOnlyState] = useState<boolean>(() =>
    readStored<boolean>(AVAILABLE_ONLY_KEY, false, (raw) =>
      raw === 'true' ? true : raw === 'false' ? false : null,
    ),
  );
  const setAvailableOnly = useCallback((v: boolean) => {
    setAvailableOnlyState(v);
    try {
      localStorage.setItem(AVAILABLE_ONLY_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const [evOnly, setEvOnlyState] = useState<boolean>(() =>
    readStored<boolean>(EV_ONLY_KEY, false, (raw) =>
      raw === 'true' ? true : raw === 'false' ? false : null,
    ),
  );
  const setEvOnly = useCallback((v: boolean) => {
    setEvOnlyState(v);
    try {
      localStorage.setItem(EV_ONLY_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const [recents, setRecents] = useState<RecentDestination[]>(() => loadRecents());

  const { result, search, searchAtCoords, retry, expandRadius } = useCarparks();

  // Once a destination resolves, remember it — coords included so the
  // next tap on this recent replays the exact same location instead of
  // re-geocoding the label (which may resolve to a different place).
  useEffect(() => {
    if (result.destination) {
      setRecents(
        pushRecent({
          name: result.destination.label,
          hint: result.destination.postal || result.destination.address.split(' ')[0] || '',
          lat: result.destination.lat,
          lng: result.destination.lng,
          address: result.destination.address,
        }),
      );
    }
  }, [result.destination]);

  const headerDestination = useMemo(
    () => result.destination?.label ?? destinationInput,
    [result.destination, destinationInput],
  );

  const [selectedCarpark, setSelectedCarpark] = useState<Carpark | null>(null);
  // If the result list refreshes (e.g. new lot counts), keep the selected
  // carpark in sync with the latest data.
  useEffect(() => {
    if (!selectedCarpark) return;
    const updated = result.carparks.find((c) => c.id === selectedCarpark.id);
    if (updated && updated !== selectedCarpark) setSelectedCarpark(updated);
  }, [result.carparks, selectedCarpark]);

  const goSearch = (q?: string) => {
    const query = (q ?? destinationInput).trim();
    if (!query) return;
    setDestinationInput(query);
    setScreen('results');
    search(query);
  };

  const goPickPlace = (place: {
    label: string;
    address: string;
    lat: number;
    lng: number;
  }) => {
    // Intentionally don't setDestinationInput here — for autocomplete picks
    // the picker already set the value, and for recents taps we don't want
    // a programmatic value change to trigger another autocomplete fetch.
    // The results screen header uses result.destination.label anyway.
    setScreen('results');
    searchAtCoords(place.label, place.lat, place.lng, place.address);
  };

  const goDetail = (cp: Carpark) => {
    setSelectedCarpark(cp);
    setScreen('detail');
  };

  const [nearMeBusy, setNearMeBusy] = useState(false);
  const onNearMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not available on this device.');
      return;
    }
    setNearMeBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearMeBusy(false);
        const { latitude, longitude } = pos.coords;
        setDestinationInput('My location');
        setScreen('results');
        searchAtCoords('My location', latitude, longitude);
      },
      (err) => {
        setNearMeBusy(false);
        alert(`Could not get your location: ${err.message}`);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, [searchAtCoords]);

  const [navToast, setNavToast] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const showNavToast = useCallback(() => {
    if (!selectedCarpark) return;
    const [lat, lng] = selectedCarpark.coords.entrance;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank', 'noopener');
    setNavToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNavToast(false), 2400);
  }, [selectedCarpark]);

  // ── Accounts & Save ──────────────────────────────────────────────
  const { user, signIn, signOut, error: authError } = useSession();
  const saves = useSaves();
  const { toast, pop } = useToast();

  // Surface OAuth errors (missing client ID, popup blocked, user cancelled)
  // as a toast so the user gets actionable feedback.
  useEffect(() => {
    if (authError) {
      pop({
        icon: <IconWarning size={15} stroke={2} />,
        title: "Couldn't sign in",
        sub: authError,
      });
    }
  }, [authError, pop]);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [addDestOpen, setAddDestOpen] = useState(false);
  const [destPrefill, setDestPrefill] = useState<AddDestPrefill | null>(null);

  const toggleSaveCarpark = useCallback(
    (cp: Carpark) => {
      const isSaved = saves.isCarparkSaved(cp.id);
      const snapshot = snapshotFromCarpark(cp, cp.estByHours[duration] ?? 0);
      saves.toggleCarpark(cp.id, snapshot);
      pop({
        icon: <IconBookmark filled={!isSaved} size={15} stroke={2} />,
        title: isSaved ? 'Removed from saved' : 'Saved to your account',
        sub: cp.name,
      });
    },
    [saves, duration, pop],
  );

  const handleSignIn = useCallback(() => {
    // Triggers the Google popup; the user state lands asynchronously when
    // the userinfo fetch resolves. The "Welcome back" toast fires from the
    // useEffect below — once we have a real name to greet.
    signIn();
  }, [signIn]);

  // After sign-in resolves, route the user to the Account screen and pop
  // a greeting with their real first name.
  const prevUserId = useRef<string | null>(null);
  useEffect(() => {
    if (user && user.id !== prevUserId.current) {
      prevUserId.current = user.id;
      const firstName = user.name.split(/\s+/)[0] || user.name;
      setScreen('account');
      pop({
        icon: <IconCheck size={15} stroke={2.5} />,
        title: `Welcome back, ${firstName}`,
        sub: 'Saves synced',
      });
    } else if (!user) {
      prevUserId.current = null;
    }
  }, [user, pop]);

  const handleSignOut = useCallback(() => {
    signOut();
    setSignOutOpen(false);
    setScreen('home');
    pop({
      icon: <IconSignOut size={15} stroke={2} />,
      title: 'Signed out',
      sub: 'Your saves are kept on your account',
    });
  }, [signOut, pop]);

  const handleAddDest = useCallback(
    (d: { name: string; address: string; icon: SavedDestination['icon'] }) => {
      saves.addDestination(d);
      setAddDestOpen(false);
      setDestPrefill(null);
      pop({
        icon: <IconCheck size={15} stroke={2.5} />,
        title: 'Destination saved',
        sub: d.name,
      });
    },
    [saves, pop],
  );

  const handleRemoveDest = useCallback(
    (id: string) => {
      saves.removeDestination(id);
      pop({
        icon: <IconTrash size={14} stroke={2} />,
        title: 'Destination removed',
      });
    },
    [saves, pop],
  );

  const handleSearchSavedDestination = useCallback(
    (d: SavedDestination) => {
      if (typeof d.lat === 'number' && typeof d.lng === 'number') {
        setScreen('results');
        searchAtCoords(d.name, d.lat, d.lng, d.address);
      } else {
        setDestinationInput(d.name);
        setScreen('results');
        search(d.address || d.name);
      }
    },
    [search, searchAtCoords],
  );

  /** From the Home merged strip or the Saved feed: try to open the carpark's
   * Detail screen. If we already have it in the current Results window we
   * jump straight there; otherwise pop a toast asking the user to search
   * first. Live-fetching a single carpark by id off the destination grid is
   * out-of-scope for this epic — the snapshot covers the recent-cost +
   * area display until they re-search. */
  const handleOpenSavedCarpark = useCallback(
    (item: MergedSaveItem & { kind: 'carpark' }) => {
      const existing = result.carparks.find((c) => c.id === item.id);
      if (existing) {
        setSelectedCarpark(existing);
        setScreen('detail');
      } else {
        pop({
          icon: <IconBookmark filled size={15} stroke={2} />,
          title: 'Search to open this carpark',
          sub: item.carpark.name,
        });
      }
    },
    [result.carparks, pop],
  );

  const openSaveDestSheet = useCallback(() => {
    if (!result.destination) return;
    setDestPrefill({
      name: result.destination.label,
      address: result.destination.address,
      icon: 'star',
    });
    setAddDestOpen(true);
  }, [result.destination]);

  const destAlreadySaved = useMemo(() => {
    if (!result.destination) return false;
    return (
      saves.isDestinationSaved(result.destination.label) ||
      saves.isDestinationSaved(result.destination.address)
    );
  }, [result.destination, saves]);

  let body: React.ReactNode = null;
  if (screen === 'home') {
    body = (
      <HomeScreen
        destination={destinationInput}
        setDestination={setDestinationInput}
        onSearch={goSearch}
        onPickPlace={goPickPlace}
        onNearMe={onNearMe}
        recents={recents}
        nearMeBusy={nearMeBusy}
        onAbout={() => setScreen('about')}
        user={user}
        onOpenAccount={() => setScreen('account')}
        merged={saves.merged}
        onOpenSaved={() => setScreen('saved')}
        onSearchSavedDestination={(item) =>
          handleSearchSavedDestination(item.destination)
        }
        onOpenSavedCarpark={handleOpenSavedCarpark}
      />
    );
  } else if (screen === 'about') {
    body = (
      <AboutScreen
        onBack={() => setScreen('home')}
        onStartSearch={() => setScreen('home')}
      />
    );
  } else if (screen === 'results') {
    body = (
      <ResultsScreen
        destination={headerDestination}
        destinationCoords={
          result.destination
            ? [result.destination.lat, result.destination.lng]
            : null
        }
        duration={duration}
        setDuration={setDuration}
        carparks={result.carparks}
        state={result.state}
        availableOnly={availableOnly}
        setAvailableOnly={setAvailableOnly}
        evOnly={evOnly}
        setEvOnly={setEvOnly}
        viewMode={viewMode}
        onToggleView={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
        onBack={() => setScreen('home')}
        onSelect={goDetail}
        onRetry={retry}
        onExpandRadius={expandRadius}
        isCarparkSaved={(id) => saves.isCarparkSaved(id)}
        onToggleSaveCarpark={toggleSaveCarpark}
        destinationSaved={destAlreadySaved}
        onSaveDestination={openSaveDestSheet}
      />
    );
  } else if (screen === 'detail' && selectedCarpark) {
    body = (
      <DetailScreen
        cp={selectedCarpark}
        destination={headerDestination}
        destinationCoords={
          result.destination
            ? [result.destination.lat, result.destination.lng]
            : null
        }
        duration={duration}
        setDuration={setDuration}
        onBack={() => setScreen('results')}
        onNavigate={showNavToast}
        refreshedSecondsAgo={result.refreshedSecondsAgo}
        degraded={result.state === 'degraded'}
        saved={saves.isCarparkSaved(selectedCarpark.id)}
        onToggleSave={() => toggleSaveCarpark(selectedCarpark)}
      />
    );
  } else if (screen === 'account') {
    body = (
      <AccountScreen
        user={user}
        savedItemCount={saves.merged.length}
        onBack={() => setScreen('home')}
        onSignIn={handleSignIn}
        onOpenSaved={() => setScreen('saved')}
        onRequestSignOut={() => setSignOutOpen(true)}
      />
    );
  } else if (screen === 'saved') {
    body = (
      <SavedScreen
        merged={saves.merged}
        destinationCount={saves.destinations.length}
        carparkCount={saves.savedCarparks.length}
        onBack={() => setScreen(user ? 'account' : 'home')}
        onSearchDestination={(item) =>
          handleSearchSavedDestination(item.destination)
        }
        onOpenCarpark={(item) => handleOpenSavedCarpark(item)}
        onRemoveDestination={handleRemoveDest}
        onUnsaveCarpark={(id) => saves.toggleCarpark(id)}
        onAddDestination={() => {
          setDestPrefill(null);
          setAddDestOpen(true);
        }}
        onGoFindCarpark={() => setScreen('home')}
      />
    );
  }

  return (
    <div className="psg-frame-wrap">
      <Analytics />
      <div className="psg-frame">
        <div className="psg-app" data-screen={screen}>
          {body}
          {navToast && (
            <div
              role="status"
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 90,
                background: 'var(--bg-2)',
                border: '0.5px solid var(--line-strong)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                zIndex: 100,
                animation: 'psg-slide-up 200ms cubic-bezier(0.22,1,0.36,1) both',
                fontSize: 13,
                color: 'var(--text-1)',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: 'var(--accent-tint-strong)',
                  color: 'var(--accent-on)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconNavigate size={15} stroke={2} />
              </span>
              <div style={{ flex: 1, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 600 }}>Opening Google Maps</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  Carpark entrance pre-loaded
                </div>
              </div>
            </div>
          )}

          <SignOutSheet
            open={signOutOpen}
            onClose={() => setSignOutOpen(false)}
            onConfirm={handleSignOut}
          />
          <AddDestSheet
            open={addDestOpen}
            onClose={() => {
              setAddDestOpen(false);
              setDestPrefill(null);
            }}
            onSave={handleAddDest}
            prefill={destPrefill}
          />
          <Toast toast={toast} bottomOffset={screen === 'detail' ? 90 : 28} />
        </div>
      </div>
    </div>
  );
}

export default App;
