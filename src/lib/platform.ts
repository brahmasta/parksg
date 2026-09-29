import { Capacitor } from '@capacitor/core';

/**
 * Runtime platform detection for the Capacitor (Android / iOS) shells.
 *
 * On the plain web build Capacitor reports `web` and `isNative` is false, so
 * every native-only branch stays dormant and the site behaves exactly as
 * before. Inside the native WebView `isNative` is true and `platform` is
 * 'ios' or 'android'.
 */
export type Platform = 'web' | 'ios' | 'android';

export const isNative: boolean = Capacitor.isNativePlatform();
export const platform: Platform = Capacitor.getPlatform() as Platform;

/**
 * Tag <html> with `native` plus `ios` / `android` so CSS can override design
 * tokens per platform (e.g. `html.native.ios { ... }`). No-op on the web.
 * Called once at boot from main.tsx, before first render.
 */
export function applyPlatformClasses(): void {
  if (!isNative || typeof document === 'undefined') return;
  document.documentElement.classList.add('native', platform);
}

/**
 * Apple-platform detection — used to decide whether to offer Apple Maps as a
 * navigation target. Apple Maps' universal link (maps.apple.com) opens the
 * native Maps app on iPhone / iPad / Mac; on Android/Windows it only reaches a
 * degraded web map, so we hide the option there.
 *
 * Mirrors the iOS sniff already in `pwa.ts` (`isIos`) and extends it to Mac
 * desktop, where the Maps app also exists.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ reports as Mac — detect via the multi-touch Mac signature.
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1) return true;
  // Mac desktop (Safari/Chrome on macOS): maps.apple.com opens Maps.app.
  if (/Macintosh/i.test(ua)) return true;
  return false;
}

/** Google sign-in uses a web popup that does not work inside the native
 *  WebView; hidden there until native auth (roadmap step 8) lands. */
export const canGoogleSignIn: boolean = !isNative;
