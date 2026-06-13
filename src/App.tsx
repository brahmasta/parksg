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
import { SavedScreen } from './screens/SavedScreen';
import {
  IconBookmark,
  IconCheck,
  IconSignOut,
  IconTrash,
  IconWarning,
} from './components/icons';
import { useCarparks, type Trigger } from './hooks/useCarparks';
import { useMediaQuery } from './hooks/useMediaQuery';
import { DesktopShell } from './desktop/DesktopShell';
import type { FindParkingDesktopProps } from './desktop/FindParkingDesktop';
import { estCostForStay, roundedSoon, type Stay } from './lib/stay';
import { findArea } from './lib/seoAreas';
import { haversineMeters, walkMinutesFromMeters } from './lib/geo';
import { loadRecents, pushRecent } from './lib/recents';
import { useSession } from './lib/auth';
import { recordSearch, recordVisit } from './lib/api/analytics';
import { snapshotFromCarpark, useSaves } from './lib/saves';
import { SignOutSheet } from './components/SignOutSheet';
import { AddDestSheet, type AddDestPrefill } from './components/AddDestSheet';
import { Toast, useToast } from './components/Toast';
import { InstallPrompt } from './components/InstallPrompt';
import { Spinner } from './components/atoms';

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

/** What the cold-load URL maps to. Parsed once, synchronously, so the app can
 * boot straight into the right screen (results / detail) with no home-screen
 * flash before an effect redirects. */
type InitialRoute =
  | { kind: 'area'; slug: string; name: string; lat: number; lng: number }
  | { kind: 'carpark'; slug: string }
  | { kind: 'query'; q: string }
  | { kind: 'cp'; id: string }
  // A shared carpark link: open carpark `cpId` (if any) with the walk distance
  // to the destination at (lat,lng) labelled `dest`. See the Share button in
  // DetailScreen.
  | { kind: 'share'; cpId: string | null; dest: string; lat: number; lng: number }
  | null;

function parseInitialRoute(): InitialRoute {
  if (typeof window === 'undefined') return null;
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);

  const areaMatch = /^\/parking-near\/([^/]+)\/?$/.exec(pathname);
  if (areaMatch) {
    const area = findArea(decodeURIComponent(areaMatch[1]));
    if (area) {
      return { kind: 'area', slug: area.slug, name: area.name, lat: area.lat, lng: area.lng };
    }
  }

  const cpMatch = /^\/carpark\/([^/]+)\/?$/.exec(pathname);
  if (cpMatch) return { kind: 'carpark', slug: decodeURIComponent(cpMatch[1]) };

  const q = params.get('q')?.trim();
  if (q) return { kind: 'query', q };

  // Shared link: `?to=lat,lng` (+ optional `cp`, `dest`) restores the carpark
  // and the walk distance to the shared destination.
  const cpId = params.get('cp');
  const to = params.get('to');
  if (to) {
    const [latS, lngS] = to.split(',');
    const lat = Number.parseFloat(latS ?? '');
    const lng = Number.parseFloat(lngS ?? '');
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { kind: 'share', cpId: cpId || null, dest: params.get('dest')?.trim() || '', lat, lng };
    }
  }
  if (cpId) return { kind: 'cp', id: cpId };

  return null;
}

function App() {
  // ≥960px renders the desktop/tablet shell; below keeps the phone flow.
  const isDesktop = useMediaQuery('(min-width: 960px)');

  // Cold-load routing parsed once from the URL, so the app boots straight into
  // the right screen — no home flash before an effect redirects. An SEO URL
  // like /parking-near/orchard lands directly on the (loading) results screen;
  // /carpark/:slug lands on Detail.
  const [initialRoute] = useState(parseInitialRoute);
  const [screen, setScreen] = useState<Screen>(() =>
    initialRoute?.kind === 'area' || initialRoute?.kind === 'query'
      ? 'results'
      : initialRoute?.kind === 'carpark' || initialRoute?.kind === 'cp'
        ? 'detail'
        : initialRoute?.kind === 'share'
          ? initialRoute.cpId
            ? 'detail'
            : 'results'
          : 'home',
  );
  const [destinationInput, setDestinationInput] = useState<string>(() =>
    initialRoute?.kind === 'query'
      ? initialRoute.q
      : initialRoute?.kind === 'share'
        ? initialRoute.dest
        : '',
  );
  // True while a deep-linked carpark (/carpark/:slug, ?cp=, or a shared link) is
  // still loading, so Detail shows a spinner instead of falling back to home.
  const [detailLoading, setDetailLoading] = useState<boolean>(
    () =>
      initialRoute?.kind === 'carpark' ||
      initialRoute?.kind === 'cp' ||
      (initialRoute?.kind === 'share' && !!initialRoute.cpId),
  );

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

  // Fire the matching search on mount for area/query cold loads, so the results
  // screen starts in its loading state from the first render (no home flash).
  const initialTrigger: Trigger | null =
    initialRoute?.kind === 'area'
      ? { kind: 'coords', label: initialRoute.name, lat: initialRoute.lat, lng: initialRoute.lng }
      : initialRoute?.kind === 'query'
        ? { kind: 'query', query: initialRoute.q }
        : initialRoute?.kind === 'share'
          ? { kind: 'coords', label: initialRoute.dest || 'Shared destination', lat: initialRoute.lat, lng: initialRoute.lng }
          : null;

  const {
    result,
    search,
    searchAtCoords,
    retry,
    expandRadius,
    loadCarparkById,
    loadCarparkBySlug,
  } = useCarparks(initialTrigger);

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

  // Log one visit per app load (DAU / device / referrer for all visitors).
  useEffect(() => {
    recordVisit();
  }, []);

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

  // Cold-load routing from the SSR/SEO URLs. The same URL that serves crawlable
  // HTML to Google/LLMs boots the SPA here and lands the human on the matching
  // *live* screen — so `/parking-near/orchard` gives the same instant results as
  // typing "Orchard Road", and `/carpark/:slug` opens straight to Detail. Runs
  // once on mount. Path routes keep their clean (shareable) URL; query-param
  // deep links (`?cp=`, `?q=`) are stripped afterwards so a refresh doesn't
  // re-trigger them.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current) return;
    deepLinkDone.current = true;

    const route = initialRoute;
    if (!route) return;

    const stripParam = (key: string) => {
      const params = new URLSearchParams(window.location.search);
      params.delete(key);
      const qs = params.toString();
      window.history.replaceState(
        null,
        '',
        window.location.pathname + (qs ? `?${qs}` : ''),
      );
    };

    void (async () => {
      // Detail deep links (`/carpark/:slug` or `?cp=<id>`) — load async then
      // swap the spinner for the carpark. The screen was already set to
      // 'detail' synchronously so there's no home flash; a failed load falls
      // back to home rather than a blank screen.
      if (route.kind === 'carpark' || route.kind === 'cp') {
        const loaded =
          route.kind === 'carpark'
            ? await loadCarparkBySlug(route.slug).catch(() => null)
            : await loadCarparkById(route.id).catch(() => null);
        if (loaded) setSelectedCarpark(loaded);
        else setScreen('home');
        setDetailLoading(false);
        if (route.kind === 'cp') stripParam('cp');
        return;
      }

      // Shared link (`?cp=&to=&dest=`). The initial trigger already searched the
      // shared destination (so result.destination drives Detail's walk card and
      // gives a populated Results screen to back out to). Open the shared carpark
      // with its walk distance computed from the shared destination; the
      // selected-carpark sync effect then swaps in the live results instance if
      // the carpark falls inside the search.
      if (route.kind === 'share') {
        if (route.cpId) {
          const loaded = await loadCarparkById(route.cpId).catch(() => null);
          if (loaded) {
            const meters = haversineMeters(
              { lat: route.lat, lng: route.lng },
              { lat: loaded.coords.entrance[0], lng: loaded.coords.entrance[1] },
            );
            setSelectedCarpark({
              ...loaded,
              walkMeters: Math.round(meters),
              walkMin: walkMinutesFromMeters(meters),
            });
          } else {
            // e.g. an ephemeral Google carpark that can't be re-fetched — leave
            // the recipient on the destination's live Results.
            setScreen('results');
          }
          setDetailLoading(false);
        }
        stripParam('cp');
        stripParam('to');
        stripParam('dest');
        return;
      }

      // `?q=<query>` powered the search via the initial trigger; just tidy the
      // URL so a refresh/share doesn't carry the param.
      if (route.kind === 'query') stripParam('q');

      // `area`: the initial trigger already ran the search and the clean
      // `/parking-near/:slug` URL is already correct and shareable — nothing
      // more to do here.
    })();
  }, [initialRoute, loadCarparkById, loadCarparkBySlug]);

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
      detailLoading,
      onOpenDetail: (cp) => setSelectedCarpark(cp),
      onCloseDetail: () => setSelectedCarpark(null),
      isCarparkSaved: (id) => saves.isCarparkSaved(id),
      onToggleSaveCarpark: toggleSaveCarpark,
      user,
      onRequireSignIn: handleSignIn,
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
        user={user}
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
        user={user}
        onRequireSignIn={handleSignIn}
      />
    );
  } else if (screen === 'detail') {
    // Deep-linked carpark (/carpark/:slug or ?cp=) still resolving.
    body = (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: 'var(--text-3)',
          fontSize: 13,
        }}
      >
        <Spinner /> Loading carpark…
      </div>
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
        onOpenAbout={() => setScreen('about')}
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
