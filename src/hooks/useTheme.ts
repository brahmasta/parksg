import { useEffect, useState } from 'react';
import { getTheme, setTheme, subscribeTheme, type Theme } from '../lib/theme';

/**
 * Read and change the active theme. Every mounted consumer re-renders when the
 * theme changes anywhere, so a picker on one surface stays in step with a
 * toggle on another.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setLocal] = useState<Theme>(getTheme);
  useEffect(() => subscribeTheme(setLocal), []);
  return [theme, setTheme];
}
