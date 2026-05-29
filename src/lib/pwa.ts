import { useCallback, useEffect, useState } from 'react';

/** The non-standard event Chromium fires when the app is installable. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'psg.pwaPromptDismissedAt';
// Once dismissed, stay quiet for a week before offering again.
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as Mac; detect touch + Safari to catch it.
  const iPadOs =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return iDevice || iPadOs;
}

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
 * `promptInstall()` to trigger the native sheet. On iOS Safari (which never
 * fires that event) we surface `iosInstructions` so the UI can show the
 * manual Share → Add to Home Screen flow.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => dismissedRecently());
  const ios = isIos();

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

  // Show the banner when:
  //  - not already installed, and
  //  - not dismissed within the cooldown, and
  //  - either Chromium gave us a prompt, OR we're on iOS Safari (manual flow).
  const canPromptChromium = deferred != null;
  const canPromptIos = ios && !installed;
  const eligible = !installed && !dismissed && (canPromptChromium || canPromptIos);

  return {
    eligible,
    installed,
    ios,
    /** True only when the native Chromium prompt is available. */
    hasNativePrompt: canPromptChromium,
    promptInstall,
    dismiss,
  };
}
