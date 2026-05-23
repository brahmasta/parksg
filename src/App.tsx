import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Carpark,
  DurationHours,
  ResultsState,
  Screen,
  ViewMode,
} from './lib/types';
import { CARPARKS, DESTINATION } from './lib/mockData';
import { HomeScreen } from './screens/HomeScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { IconNavigate } from './components/icons';

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
  const [destination, setDestination] = useState<string>(DESTINATION.label);

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

  const [selectedCarpark, setSelectedCarpark] = useState<Carpark | null>(null);
  const [resultsState, setResultsState] = useState<ResultsState>('loaded');
  const loadingTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    };
  }, []);

  const goSearch = (q?: string) => {
    if (q !== undefined) setDestination(q);
    setResultsState('loading');
    setScreen('results');
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
    loadingTimer.current = window.setTimeout(() => {
      setResultsState('loaded');
    }, 650);
  };

  const goDetail = (cp: Carpark) => {
    setSelectedCarpark(cp);
    setScreen('detail');
  };

  const [navToast, setNavToast] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const showNavToast = () => {
    setNavToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNavToast(false), 2400);
  };

  let body: React.ReactNode = null;
  if (screen === 'home') {
    body = (
      <HomeScreen
        destination={destination}
        setDestination={setDestination}
        duration={duration}
        setDuration={setDuration}
        onSearch={goSearch}
        onNearMe={() => {
          setDestination('My location');
          goSearch('My location');
        }}
      />
    );
  } else if (screen === 'results') {
    body = (
      <ResultsScreen
        destination={destination}
        duration={duration}
        setDuration={setDuration}
        carparks={CARPARKS}
        state={resultsState}
        availableOnly={availableOnly}
        setAvailableOnly={setAvailableOnly}
        viewMode={viewMode}
        onToggleView={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
        onBack={() => setScreen('home')}
        onSelect={goDetail}
        onRetry={() => {
          setResultsState('loading');
          if (loadingTimer.current) clearTimeout(loadingTimer.current);
          loadingTimer.current = window.setTimeout(
            () => setResultsState('loaded'),
            700,
          );
        }}
        onExpandRadius={() => {
          setResultsState('loading');
          if (loadingTimer.current) clearTimeout(loadingTimer.current);
          loadingTimer.current = window.setTimeout(
            () => setResultsState('loaded'),
            700,
          );
        }}
      />
    );
  } else if (screen === 'detail') {
    body = (
      <DetailScreen
        cp={selectedCarpark ?? CARPARKS[0]}
        destination={destination}
        duration={duration}
        setDuration={setDuration}
        onBack={() => setScreen('results')}
        onNavigate={showNavToast}
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
