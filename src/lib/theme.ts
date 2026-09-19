// Theme system — three surfaces selected by one `data-theme` attribute on
// <html>, which picks the matching token block in index.css:
//
//   sunlight — the max-legibility light theme, and the default. Every text
//              tier and status colour clears WCAG AA (4.5:1) on its own
//              surface, the page ground is grey so white cards read as
//              objects instead of white-on-white, and shadows are heavy
//              enough to mean something outdoors. Built for the real use
//              case: a phone held at arm's length in Singapore daylight.
//   light    — the original soft theme. Lower contrast, calmer indoors.
//   dark     — near-black, easier at night.
//
// The default is a DEPLOY-TIME choice: set `VITE_DEFAULT_THEME` (Vercel →
// Project → Settings → Environment Variables, or .env.local) to sunlight |
// light | dark and redeploy — Vite inlines VITE_* vars at build time. An
// unset or unrecognised value falls back to 'sunlight'.
//
// A user's own pick is stored in localStorage and always beats the default.
//
// A tiny inline script in index.html runs this same resolution before first
// paint so the correct theme is on the document immediately (no flash of the
// wrong palette). initTheme() re-applies it after boot, which covers any
// document that did not carry the script — e.g. an SSR-injected shell — and
// keeps the <meta name="theme-color"> in sync.

export type Theme = 'sunlight' | 'light' | 'dark';

/** Order here is the order shown in the picker. */
export const THEMES: { id: Theme; label: string; blurb: string }[] = [
  {
    id: 'sunlight',
    label: 'Sunlight',
    blurb: 'Highest contrast — stays readable in direct sun.',
  },
  {
    id: 'light',
    label: 'Standard',
    blurb: 'The softer light theme. Easier on the eyes indoors.',
  },
  {
    id: 'dark',
    label: 'Dark',
    blurb: 'Near-black. Less glare at night.',
  },
];

/** localStorage key holding the user's explicit pick, if any. */
export const STORAGE_KEY = 'psg:theme';

/** Kept in sync with the `<meta name="theme-color">` the browser chrome uses. */
const META_THEME_COLOR: Record<Theme, string> = {
  sunlight: '#eef1f5',
  light: '#fafafa',
  dark: '#12151a',
};

export function isTheme(value: unknown): value is Theme {
  return value === 'sunlight' || value === 'light' || value === 'dark';
}

/**
 * Theme used when the visitor has not picked one. Set `VITE_DEFAULT_THEME` in
 * the deploy environment to change it without editing code.
 */
export const DEFAULT_THEME: Theme = resolveDefault();

function resolveDefault(): Theme {
  const configured = import.meta.env.VITE_DEFAULT_THEME;
  return isTheme(configured) ? configured : 'sunlight';
}

function readStored(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    // Private mode, disabled storage, or a sandboxed iframe — not fatal.
    return null;
  }
}

/** The theme in effect right now: the user's pick, else the deploy default. */
export function getTheme(): Theme {
  return readStored() ?? DEFAULT_THEME;
}

/** True when the visitor has never chosen — i.e. they are on the default. */
export function isUsingDefault(): boolean {
  return readStored() === null;
}

const listeners = new Set<(theme: Theme) => void>();

/** Subscribe to theme changes. Returns an unsubscribe function. */
export function subscribeTheme(fn: (theme: Theme) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function paint(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META_THEME_COLOR[theme]);
}

/** Apply a theme, remember it, and notify subscribers. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the choice just won't survive a reload.
  }
  paint(theme);
  listeners.forEach((fn) => fn(theme));
}

/** Forget the explicit pick and fall back to the deploy default. */
export function clearThemeOverride(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
  paint(DEFAULT_THEME);
  listeners.forEach((fn) => fn(DEFAULT_THEME));
}

/** Apply the resolved theme to the document. Safe to call more than once. */
export function initTheme(): void {
  paint(getTheme());
}
