import { useCallback, useEffect, useState } from 'react';
import { isAndroid } from './appStore';
import { isNative } from './platform';

/** The non-standard event Chromium fires when the app is installable. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'psg.pwaPromptDismissedAt';
// Once dismissed, stay quiet for a week before offering again.
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone when launched from home screen.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * PWA install state. On Chromium we capture `beforeinstallprompt` and expose
 * `promptInstall()` to trigger the native sheet. iOS has the App Store app
 * instead (lib/appStore.ts).
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => dismissedRecently());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Stop Chrome's default mini-infobar; we drive our own UI.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') setInstalled(true);
    return choice.outcome;
  }, [deferred]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  // Show the banner when Chromium gave us a prompt, the site isn't installed
  // and it wasn't dismissed within the cooldown. Phones are pointed at their
  // store app instead (AppStoreBanner, Apple's Smart App Banner): iPhone no
  // longer gets Share → Add to Home Screen, and Android no longer gets the
  // PWA install, so this is desktop Chromium only.
  const canPromptChromium = deferred != null;
  // Never inside the Capacitor shells: the app is already installed.
  const eligible = !isNative && !isAndroid() && !installed && !dismissed && canPromptChromium;

  return {
    eligible,
    installed,
    promptInstall,
    dismiss,
  };
}
