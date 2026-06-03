import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Analytics, track } from '@vercel/analytics/react';
import type {
  Carpark,
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
import { CoverageScreen } from './screens/CoverageScreen';
import { SavedScreen } from './screens/SavedScreen';
import {
  IconBookmark,
  IconCheck,
  IconSignOut,
  IconTrash,
  IconWarning,
} from './components/icons';
import { useCarparks } from './hooks/useCarparks';
import { useMediaQuery } from './hooks/useMediaQuery';
import { DesktopShell } from './desktop/DesktopShell';
import type { FindParkingDesktopProps } from './desktop/FindParkingDesktop';
import { estCostForStay, roundedSoon, type Stay } from './lib/stay';
import { loadRecents, pushRecent } from './lib/recents';
import { useSession } from './lib/auth';
import { recordSearch } from './lib/api/analytics';
import { snapshotFromCarpark, useSaves } from './lib/saves';
import { SignOutSheet } from './components/SignOutSheet';
import { AddDestSheet, type AddDestPrefill } from './components/AddDestSheet';
import { Toast, useToast } from './components/Toast';
import { InstallPrompt } from './components/InstallPrompt';

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
  // ≥960px renders the desktop/tablet shell; below keeps the phone flow.
  const isDesktop = useMediaQuery('(min-width: 960px)');
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

  // Desktop planned-stay (now/later + 0.5–24h). Drives arbitrary-duration cost
  // in the desktop Find view; the phone flow keeps the preset `duration`.
  const [stay, setStay] = useState<Stay>(() => ({ startMode: 'now', startAt: roundedSoon(), hours: 2 }));

  const { result, search, searchAtCoords, retry, expandRadius, loadCarparkById } =
    useCarparks();

  // Results scroll offset, preserved across Detail→back (the Results screen
  // unmounts when Detail opens). Reset on a fresh search so a new destination
  // starts at the top. See BUG-1.
  const resultsScrollRef = useRef(0);

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
    resultsScrollRef.current = 0;
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
    resultsScrollRef.current = 0;
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
        resultsScrollRef.current = 0;
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

  // ── Accounts & Save ──────────────────────────────────────────────
  const { user, signIn, signOut, markSynced, error: authError } = useSession();
  const saves = useSaves(user?.id ?? null, {
    onSynced: (ts) => markSynced(ts),
  });
  const { toast, pop } = useToast();

  // Best-effort: log every resolved destination search to Supabase so the
  // owner can query top searches. Fires once per resolved destination (the
  // object identity changes on each search); attaches the user id when known.
  useEffect(() => {
    if (result.destination) {
      recordSearch({
        query: result.destination.label,
        lat: result.destination.lat,
        lng: result.destination.lng,
        userId: user?.id ?? null,
      });
    }
    // Intentionally keyed only on the resolved destination so re-renders
    // (e.g. a later sign-in) don't double-count the same search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.destination]);

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
      // Google supplementary carparks are view-only — never persisted (ToS).
      // The UI hides the save affordance; this guards the path defensively.
      if (cp.source === 'GOOGLE') return;
      const isSaved = saves.isCarparkSaved(cp.id);
      const snapshot = snapshotFromCarpark(cp, estCostForStay(cp, stay) ?? 0);
      saves.toggleCarpark(cp.id, snapshot);
      pop({
        icon: <IconBookmark filled={!isSaved} size={15} stroke={2} />,
        title: isSaved ? 'Removed from saved' : 'Saved to your account',
        sub: cp.name,
      });
    },
    [saves, stay, pop],
  );

  const handleSignIn = useCallback(() => {
    // Triggers the Google popup; the user state lands asynchronously when
    // the userinfo fetch resolves. The "Welcome back" toast fires from the
    // useEffect below — once we have a real name to greet.
    signIn();
  }, [signIn]);

  // After sign-in resolves, route the user to the Account screen and pop
  // a greeting with their real first name. Seed the ref with the already
  // persisted session id so a cold load of an existing session is a no-op —
  // only a *fresh* sign-in (user transitions from null) redirects + greets.
  const prevUserId = useRef<string | null>(user ? user.id : null);
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
    (d: {
      name: string;
      address: string;
      icon: SavedDestination['icon'];
      lat?: number;
      lng?: number;
    }) => {
      // Persist coords when the sheet forwarded them (hot-path save).
      // Chip tap later uses searchAtCoords with d.name as the header label,
      // so the friendly name survives and the exact location is preserved.
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

  /** From the Home merged strip or the Saved feed: open the carpark's Detail
   * screen directly. If it's already in the current Results window we reuse
   * that (live lots already attached); otherwise we fetch it by id from the
   * DB — anchored on its own coords, so walk distance is ~0 and Detail runs
   * without a surrounding destination search. */
  const handleOpenSavedCarpark = useCallback(
    async (item: MergedSaveItem & { kind: 'carpark' }) => {
      const existing = result.carparks.find((c) => c.id === item.id);
      if (existing) {
        setSelectedCarpark(existing);
        setScreen('detail');
        return;
      }
      const loaded = await loadCarparkById(item.id).catch(() => null);
      if (loaded) {
        setSelectedCarpark(loaded);
        setScreen('detail');
      } else {
        pop({
          icon: <IconWarning size={15} stroke={2} />,
          title: "Couldn't open this carpark",
          sub: item.carpark.name,
        });
      }
    },
    [result.carparks, loadCarparkById, pop],
  );

  // Deep link from the SSR landing pages: `/?cp=<id>` opens that carpark's
  // Detail directly on cold load. Runs once; strips the param afterwards so a
  // refresh or share of the resulting URL doesn't re-trigger it.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const cp = params.get('cp');
    if (!cp) return;
    void (async () => {
      const loaded = await loadCarparkById(cp).catch(() => null);
      if (loaded) {
        setSelectedCarpark(loaded);
        setScreen('detail');
      }
      params.delete('cp');
      const qs = params.toString();
      window.history.replaceState(
        null,
        '',
        window.location.pathname + (qs ? `?${qs}` : ''),
      );
    })();
  }, [loadCarparkById]);

  const openSaveDestSheet = useCallback(() => {
    if (!result.destination) return;
    setDestPrefill({
      name: result.destination.label,
      address: result.destination.address,
      icon: 'star',
      // Capture coords so the saved record round-trips back to the exact
      // location on chip tap (rather than re-geocoding the address, which
      // can drift if the address string isn't a perfect OneMap match).
      lat: result.destination.lat,
      lng: result.destination.lng,
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

  // ── Desktop/tablet shell (≥960px) ───────────────────────────────────
  // Shares every data hook + handler with the phone flow; only the
  // presentation layer forks. The desktop "Find parking" view manages its
  // own detail panel via selectedCarpark (the phone `screen` state is unused
  // here). Overlays (sheets, toast) still mount alongside.
  if (isDesktop) {
    const findProps: FindParkingDesktopProps = {
      destinationInput,
      setDestinationInput,
      headerDestination,
      onSearch: goSearch,
      onPickPlace: goPickPlace,
      onNearMe,
      nearMeBusy,
      carparks: result.carparks,
      state: result.state,
      destinationCoords: result.destination
        ? [result.destination.lat, result.destination.lng]
        : null,
      refreshedSecondsAgo: result.refreshedSecondsAgo,
      stay,
      setStay,
      availableOnly,
      setAvailableOnly,
      detailCp: selectedCarpark,
      onOpenDetail: (cp) => setSelectedCarpark(cp),
      onCloseDetail: () => setSelectedCarpark(null),
      isCarparkSaved: (id) => saves.isCarparkSaved(id),
      onToggleSaveCarpark: toggleSaveCarpark,
    };
    return (
      <>
        <Analytics />
        <DesktopShell
          find={findProps}
          saved={{
            merged: saves.merged,
            destinationCount: saves.destinations.length,
            carparkCount: saves.savedCarparks.length,
            onSearchDestination: (item) => handleSearchSavedDestination(item.destination),
            onOpenCarpark: (item) => handleOpenSavedCarpark(item),
            onRemoveDestination: handleRemoveDest,
            onUnsaveCarpark: (id) => saves.toggleCarpark(id),
            onAddDestination: () => {
              setDestPrefill(null);
              setAddDestOpen(true);
            },
          }}
          user={user}
          savedItemCount={saves.merged.length}
          onSignIn={handleSignIn}
          onRequestSignOut={() => setSignOutOpen(true)}
        />
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
        <Toast toast={toast} bottomOffset={28} />
      </>
    );
  }

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
        stay={stay}
        setStay={setStay}
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
        initialScrollTop={resultsScrollRef.current}
        onScrollChange={(y) => {
          resultsScrollRef.current = y;
        }}
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
        stay={stay}
        setStay={setStay}
        onBack={() => setScreen('results')}
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
        onOpenCoverage={() => setScreen('coverage')}
        onOpenAbout={() => setScreen('about')}
      />
    );
  } else if (screen === 'coverage') {
    body = (
      <CoverageScreen
        onFindParking={() => setScreen('home')}
        onBack={() => setScreen('account')}
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
          {/* PWA install banner — only on the Home landing surface so it
              never collides with the Detail sticky CTA or results flow. */}
          {screen === 'home' && <InstallPrompt />}
        </div>
      </div>
    </div>
  );
}

export default App;
