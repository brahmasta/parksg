import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. Used to fork the app between the phone flow
 * (< 960px) and the desktop/tablet shell (≥ 960px). SSR-safe: returns false
 * until mounted, so the server-rendered markup matches the initial client paint.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
