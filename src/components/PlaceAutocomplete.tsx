import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  autocomplete,
  newSessionToken,
  placeDetails,
  type PlaceSuggestion,
  type ResolvedPlace,
} from '../lib/api/googlePlaces';
import { IconChevronRight, IconClose, IconPin, IconSearch } from './icons';
import { Spinner } from './atoms';

const DEBOUNCE_MS = 200;

export function PlaceAutocomplete({
  value,
  onChange,
  onSubmitText,
  onPickPlace,
  placeholder = 'Where to?',
}: {
  value: string;
  onChange: (v: string) => void;
  /** Fired when the user hits enter (or the submit arrow) without picking
   * a suggestion. The caller should resolve the raw text itself. */
  onSubmitText: (v: string) => void;
  /** Fired when the user picks a suggestion and details resolve. */
  onPickPlace: (place: ResolvedPlace) => void;
  placeholder?: string;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [resolving, setResolving] = useState(false);

  const sessionTokenRef = useRef<string>(newSessionToken());
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Tracks whether the current `value` came from a programmatic set (e.g. a
  // pick or a recent destination tap) vs. user typing. We don't want to fire
  // autocomplete for programmatic changes.
  const skipNextFetchRef = useRef(false);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Debounced fetch when value is long enough. Short / programmatic-change
  // cases are handled in the input's onChange handler instead so we don't
  // call setState directly from an effect body.
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      autocomplete(q, sessionTokenRef.current, ctrl.signal)
        .then((sugs) => {
          if (ctrl.signal.aborted) return;
          setSuggestions(sugs);
          setOpen(true);
          setHighlight(sugs.length > 0 ? 0 : -1);
        })
        .catch((err) => {
          if (ctrl.signal.aborted || err?.name === 'AbortError') return;
          // Silent failure — the input still lets the user submit raw text.
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => {
          if (ctrl.signal.aborted) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleChange = useCallback((next: string) => {
    onChange(next);
    if (next.trim().length < 2) {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSuggestions([]);
      setOpen(false);
      setHighlight(-1);
      setLoading(false);
    }
  }, [onChange]);

  const pick = useCallback(
    async (sug: PlaceSuggestion) => {
      setOpen(false);
      setResolving(true);
      // Reflect the picked label immediately; suppress the fetch that would
      // otherwise run for this programmatic change.
      skipNextFetchRef.current = true;
      onChange(sug.primary);
      try {
        const token = sessionTokenRef.current;
        const place = await placeDetails(sug.placeId, token);
        // Rotate the session token after a successful pick so the next
        // typeahead is a fresh billing event.
        sessionTokenRef.current = newSessionToken();
        if (place) onPickPlace(place);
        else onSubmitText(sug.primary);
      } catch {
        onSubmitText(sug.primary);
      } finally {
        setResolving(false);
      }
    },
    [onChange, onPickPlace, onSubmitText],
  );

  const submitText = useCallback(() => {
    const v = value.trim();
    if (!v) return;
    setOpen(false);
    onSubmitText(v);
  }, [value, onSubmitText]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setOpen(true);
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setOpen(true);
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && highlight >= 0 && suggestions[highlight]) {
        void pick(suggestions[highlight]);
      } else {
        submitText();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitText();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          background: 'var(--bg-2)',
          border: '0.5px solid var(--line-strong)',
          borderRadius: 14,
          position: 'relative',
          zIndex: 2,
        }}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-haspopup="listbox"
        aria-owns={listId}
      >
        <IconSearch
          size={18}
          stroke={2}
          style={{ color: 'var(--text-2)', flexShrink: 0 }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          aria-label="Search destination"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={
            open && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
          }
          autoComplete="off"
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: 'none',
            background: 'transparent',
            color: 'var(--text-1)',
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            letterSpacing: -0.1,
            padding: 0,
          }}
        />
        {(loading || resolving) && (
          <span style={{ flexShrink: 0, display: 'inline-flex' }}>
            <Spinner size={14} />
          </span>
        )}
        {value && !loading && !resolving && (
          <button
            type="button"
            onClick={() => {
              skipNextFetchRef.current = true;
              onChange('');
              setSuggestions([]);
              setOpen(false);
              setHighlight(-1);
            }}
            aria-label="Clear search"
            style={{
              appearance: 'none',
              border: 0,
              padding: 0,
              width: 22,
              height: 22,
              borderRadius: 999,
              background: 'var(--bg-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-2)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <IconClose size={12} stroke={2.5} />
          </button>
        )}
        {value && (
          <button
            type="submit"
            aria-label="Search"
            style={{
              appearance: 'none',
              border: 0,
              padding: 0,
              width: 30,
              height: 30,
              borderRadius: 999,
              background: 'var(--accent)',
              color: 'var(--accent-on)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(46,227,194,0.35)',
            }}
          >
            <IconChevronRight size={16} stroke={2.5} />
          </button>
        )}
      </form>

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            background: 'var(--bg-1)',
            border: '0.5px solid var(--line-strong)',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
            zIndex: 5,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => {
            const active = i === highlight;
            return (
              <li key={s.placeId} style={{ margin: 0 }}>
                <button
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => {
                    // Prevent input blur before click handler fires.
                    e.preventDefault();
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => void pick(s)}
                  style={{
                    appearance: 'none',
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: active ? 'var(--bg-2)' : 'transparent',
                    border: 0,
                    borderRadius: 8,
                    color: 'var(--text-1)',
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: 'var(--bg-3)',
                      color: 'var(--text-2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconPin size={13} stroke={2} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--text-1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.primary}
                    </span>
                    {s.secondary && (
                      <span
                        style={{
                          display: 'block',
                          marginTop: 1,
                          fontSize: 11.5,
                          color: 'var(--text-3)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
