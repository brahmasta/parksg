import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { subscribeTheme } from './theme';
import { isNative } from './platform';

/** Native only: keep the system bar icons legible against the current theme
 *  (light icons on the dark theme, dark icons otherwise) and dismiss the
 *  splash once the first frame is up. Called once at boot from main.tsx. */
export function initNativeShell(): void {
  if (!isNative) return;

  const paintBars = (theme: string) => {
    SystemBars.setStyle({
      style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    }).catch(() => {});
  };
  // subscribeTheme only fires on change, so paint the current theme directly.
  paintBars(document.documentElement.getAttribute('data-theme') ?? 'light');
  subscribeTheme((_pref, theme) => paintBars(theme));

  requestAnimationFrame(() => {
    SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
  });
}
