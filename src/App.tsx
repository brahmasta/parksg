import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Carpark,
  DurationHours,
  RecentDestination,
  Screen,
  ViewMode,
} from './lib/types';
import { HomeScreen } from './screens/HomeScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { IconNavigate } from './components/icons';
import { useCarparks } from './hooks/useCarparks';
import { loadRecents, pushRecent } from './lib/recents';

const DURATION_KEY = 'psg.duration';
const VIEW_MODE_KEY = 'psg.viewMode';
const AVAILABLE_ONLY_KEY = 'psg.availableOnly';

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

  const [recents, setRecents] = useState<RecentDestination[]>(() => loadRecents());

  const { result, search, searchAtCoords, retry, expandRadius } = useCarparks();

  // Once a destination resolves, remember it.
  useEffect(() => {
    if (result.destination) {
      setRecents(
        pushRecent({
          name: result.destination.label,
          hint: result.destination.postal || result.destination.address.split(' ')[0] || '',
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

  let body: React.ReactNode = null;
  if (screen === 'home') {
    body = (
      <HomeScreen
        destination={destinationInput}
        setDestination={setDestinationInput}
        onSearch={goSearch}
        onNearMe={onNearMe}
        recents={recents}
        nearMeBusy={nearMeBusy}
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
        viewMode={viewMode}
        onToggleView={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
        onBack={() => setScreen('home')}
        onSelect={goDetail}
        onRetry={retry}
        onExpandRadius={expandRadius}
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
      />
    );
  }

  return (
    <div className="psg-frame-wrap">
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
        </div>
      </div>
    </div>
  );
}

export default App;
