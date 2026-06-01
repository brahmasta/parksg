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
