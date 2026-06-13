import { useEffect, useRef, useState } from 'react';
import {
  autocomplete,
  placeDetails,
  newSessionToken,
  type PlaceSuggestion,
} from '../lib/api/googlePlaces';

export type SelectedPlace = { name: string; address: string; lat: number; lng: number };

/** Debounced Google Places (New) location search with a suggestions dropdown.
 * Picking a suggestion resolves its coordinates via Place Details and fires
 * `onSelect`. Used by the carpark location pickers (admin add-form + the
 * customer "Add a carpark" dialog) to recenter the map.
 *
 * Note: the resolved coordinate is only used to recenter the map; the value we
 * persist is the user's confirmed map pin (see LatLngPicker), so we don't store
 * Google place content per Maps Platform terms. */
export function PlaceSearch({
  onSelect,
  placeholder = 'Search a building or address…',
}: {
  onSelect: (p: SelectedPlace) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef<string>(newSessionToken());
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounced autocomplete; all state updates happen in the timeout callback.
  useEffect(() => {
    const term = q.trim();
    const ctrl = new AbortController();
    const h = setTimeout(() => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      autocomplete(term, tokenRef.current, ctrl.signal)
        .then((s) => {
          setResults(s);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      clearTimeout(h);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const pick = async (s: PlaceSuggestion) => {
    setOpen(false);
    setQ(s.primary);
    try {
      const place = await placeDetails(s.placeId, tokenRef.current);
      tokenRef.current = newSessionToken(); // start a fresh billing session after a pick
      if (place) onSelect({ name: place.label, address: place.address, lat: place.lat, lng: place.lng });
    } catch {
      /* ignore — the user can still drop a pin manually */
    }
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '11px 13px', borderRadius: 12,
          border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)',
          color: 'var(--text-1)', fontSize: 14, outline: 'none',
        }}
      />
      {open && q.trim().length >= 2 && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
            background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 12,
            boxShadow: 'var(--shadow-card)', maxHeight: 260, overflowY: 'auto',
          }}
        >
          {loading && results.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-3)' }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-3)' }}>No matches.</div>
          ) : (
            results.map((s, i) => (
              <button
                key={s.placeId}
                type="button"
                onClick={() => pick(s)}
                style={{
                  appearance: 'none', display: 'block', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 0,
                  borderTop: i === 0 ? 0 : '0.5px solid var(--line)',
                  padding: '10px 14px', cursor: 'pointer', color: 'var(--text-1)',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.primary}</div>
                {s.secondary && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.secondary}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
