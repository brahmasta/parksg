import { useEffect, useRef, useState } from 'react';
import { searchOneMap, type OneMapPlace } from '../lib/api/onemapSearch';

/** Debounced OneMap location search box with a results dropdown. Selecting a
 * result fires `onSelect` and clears the dropdown. */
export function OneMapSearch({
  onSelect,
  placeholder = 'Search a place (OneMap)…',
}: {
  onSelect: (p: OneMapPlace) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<OneMapPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounced search; aborts the in-flight request when the query changes.
  // All state updates happen inside the timeout callback (not synchronously in
  // the effect body) to avoid cascading-render lint.
  useEffect(() => {
    const term = q.trim();
    const ctrl = new AbortController();
    const h = setTimeout(() => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      searchOneMap(term, ctrl.signal)
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => {
      clearTimeout(h);
      ctrl.abort();
    };
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (p: OneMapPlace) => {
    onSelect(p);
    setQ(p.name);
    setOpen(false);
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
      {open && (q.trim().length >= 2) && (
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
            results.map((p, i) => (
              <button
                key={`${p.lat},${p.lng},${i}`}
                type="button"
                onClick={() => pick(p)}
                style={{
                  appearance: 'none', display: 'block', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 0,
                  borderTop: i === 0 ? 0 : '0.5px solid var(--line)',
                  padding: '10px 14px', cursor: 'pointer', color: 'var(--text-1)',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                {p.address && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.address}
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
