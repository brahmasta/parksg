import { useEffect, useState } from 'react';
import {
  getPref,
  getTheme,
  setPref,
  subscribeTheme,
  type Theme,
  type ThemePref,
} from '../lib/theme';

/**
 * Read and change the theme.
 *
 * `pref` is what the visitor chose (including 'auto'); `theme` is the palette
 * actually painted. Every mounted consumer re-renders when the theme changes
 * anywhere — including when the device flips to dark while 'auto' is active —
 * so the header toggle and the Appearance picker never disagree.
 */
export function useTheme(): {
  pref: ThemePref;
  theme: Theme;
  setPref: (pref: ThemePref) => void;
} {
  const [state, setState] = useState<{ pref: ThemePref; theme: Theme }>(() => ({
    pref: getPref(),
    theme: getTheme(),
  }));

  useEffect(
    () => subscribeTheme((pref, theme) => setState({ pref, theme })),
    [],
  );

  return { ...state, setPref };
}
