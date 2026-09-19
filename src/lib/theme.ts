// Theme system — a preference the visitor picks, resolved to one of three
// palettes and applied as `data-theme` on <html>, which selects the matching
// token block in index.css:
//
//   sunlight — the max-legibility light theme. Every text tier and status
//              colour clears WCAG AA (4.5:1) on its own surface, the page
//              ground is grey so white cards read as objects instead of
//              white-on-white, and shadows are heavy enough to mean something
//              outdoors. Built for a phone held at arm's length in Singapore
//              daylight.
//   light    — the original soft theme. Lower contrast, calmer indoors.
//   dark     — near-black, easier at night.
//
// The PREFERENCE adds a fourth value, 'auto', which follows the device:
// `prefers-color-scheme: dark` gives dark, anything else gives sunlight. Auto
// is the default, because most people express "I want dark mode" through their
// OS setting and never open an app's settings screen. It stays live — flipping
// the device theme repaints immediately, no reload.
//
// The default preference is a DEPLOY-TIME choice: set `VITE_DEFAULT_THEME`
// (Vercel → Project → Settings → Environment Variables, or .env.local) to
// auto | sunlight | light | dark and redeploy. Vite inlines VITE_* vars at
// build time; an unset or unrecognised value falls back to 'auto'.
//
// A visitor's own pick is stored in localStorage and always beats the default.
//
// A tiny inline script in index.html runs this same resolution before first
// paint, so the correct palette is on the document immediately (no flash).
// initTheme() re-applies it after boot — covering any document served without
// that script, e.g. an SSR-injected shell — and starts the OS-change listener.

/** A palette that can actually be painted. */
export type Theme = 'sunlight' | 'light' | 'dark';

/** What the visitor chose. 'auto' resolves against the device setting. */
export type ThemePref = Theme | 'auto';

/**
 * Which palette 'auto' uses when the device is NOT in dark mode. Sunlight
 * rather than light: someone who has expressed no preference is better served
 * by the readable one.
 */
const AUTO_LIGHT: Theme = 'sunlight';

/** Order here is the order shown in the picker. */
export const THEME_OPTIONS: { id: ThemePref; label: string; blurb: string }[] = [
  {
    id: 'auto',
    label: 'Auto',
    blurb: 'Follows your device — dark at night if your phone is set that way.',
  },
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

/** localStorage key holding the visitor's explicit pick, if any. */
export const STORAGE_KEY = 'psg:theme';

/** Kept in sync with the `<meta name="theme-color">` the browser chrome uses. */
const META_THEME_COLOR: Record<Theme, string> = {
  sunlight: '#eef1f5',
  light: '#fafafa',
  dark: '#12151a',
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isThemePref(value: unknown): value is ThemePref {
  return (
    value === 'auto' ||
    value === 'sunlight' ||
    value === 'light' ||
    value === 'dark'
  );
}

/**
 * Preference used when the visitor has not picked one. Set
 * `VITE_DEFAULT_THEME` in the deploy environment to change it without a code
 * edit.
 */
export const DEFAULT_PREF: ThemePref = resolveDefaultPref();

function resolveDefaultPref(): ThemePref {
  const configured = import.meta.env.VITE_DEFAULT_THEME;
  return isThemePref(configured) ? configured : 'auto';
}

/** True when the device asks for a dark UI. */
export function prefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    // No matchMedia (very old browser, some embedded webviews).
    return false;
  }
}

/** Turn a preference into the palette to paint. */
export function resolveTheme(pref: ThemePref): Theme {
  if (pref !== 'auto') return pref;
  return prefersDark() ? 'dark' : AUTO_LIGHT;
}

function readStored(): ThemePref | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemePref(raw) ? raw : null;
  } catch {
    // Private mode, disabled storage, or a sandboxed iframe — not fatal.
    return null;
  }
}

/** The visitor's preference: their pick, else the deploy default. */
export function getPref(): ThemePref {
  return readStored() ?? DEFAULT_PREF;
}

/** The palette in effect right now. */
export function getTheme(): Theme {
  return resolveTheme(getPref());
}

const listeners = new Set<(pref: ThemePref, theme: Theme) => void>();

/** Subscribe to theme changes. Returns an unsubscribe function. */
export function subscribeTheme(
  fn: (pref: ThemePref, theme: Theme) => void,
): () => void {
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

function announce(): void {
  const pref = getPref();
  const theme = resolveTheme(pref);
  paint(theme);
  listeners.forEach((fn) => fn(pref, theme));
}

/** Record a preference, apply it, and notify subscribers. */
export function setPref(pref: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Non-fatal: the choice just won't survive a reload.
  }
  announce();
}

/**
 * One-tap dark toggle for the header. Explicitly picks dark or the readable
 * light palette — it does not return to 'auto', which stays available in the
 * Appearance picker.
 */
export function toggleDark(): void {
  setPref(getTheme() === 'dark' ? AUTO_LIGHT : 'dark');
}

/**
 * Apply the resolved theme and keep 'auto' live against the device setting.
 * Safe to call more than once; returns a teardown for the OS listener.
 */
export function initTheme(): () => void {
  announce();
  try {
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      // Only 'auto' tracks the device; an explicit pick stays put.
      if (getPref() === 'auto') announce();
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}
