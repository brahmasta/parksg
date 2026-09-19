/**
 * Product-analytics event stream — the client half of `app_events` (db
 * migration 005).
 *
 * `analytics.ts` records the three coarse facts the admin dashboard has always
 * needed (a visit, a search, a sign-in). This module records the *sequence* of
 * what someone did, so the dashboard can answer funnel and retention questions:
 * of everyone who opened the app, how many searched, saw results, opened a
 * carpark, and actually navigated there.
 *
 * Design notes:
 *
 *  - Buffered, not per-call. A single parking session fires a dozen events;
 *    sending a dozen requests from a phone on mobile data is wasteful. Events
 *    accumulate and flush on a short timer, on a full buffer, and whenever the
 *    page is hidden or unloaded.
 *
 *  - `keepalive` on every flush, so the last batch still lands when the user
 *    backgrounds the PWA or hands off to Google Maps.
 *
 *  - Fire-and-forget, exactly like analytics.ts: every failure is swallowed.
 *    Losing an event must never break a search or a navigation.
 *
 *  - No new identity. Reuses the same anonymous `psg.cid` client id as DAU, so
 *    funnels and the existing visit metrics describe the same population.
 */

import { getClientId, getDevice } from './analytics';

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Event names must match the DB's `clean_event_name` guard — lowercase
 *  snake_case. Anything else is dropped server-side, so keep this union as the
 *  single source of truth and let TypeScript catch typos at the call site. */
export type EventName =
  // Core funnel (admin_event_analytics reads these five by name, in order).
  | 'app_open'
  | 'search_submitted'
  | 'results_viewed'
  | 'carpark_viewed'
  | 'navigate_clicked'
  // Engagement / feature usage.
  | 'filter_applied'
  | 'view_mode_changed'
  | 'carpark_saved'
  | 'destination_saved'
  | 'stay_planner_used'
  | 'checkin_submitted'
  | 'inaccuracy_reported'
  | 'carpark_add_started'
  | 'carpark_add_submitted'
  | 'edit_suggested'
  | 'sign_in_started'
  | 'sign_in_completed'
  | 'install_prompt_shown'
  | 'install_accepted'
  // Generic UI click, captured by the delegated tracker below. The
  // control is identified by the `target` prop, not the event name.
  | 'ui_click';

// `undefined` is allowed because optional fields (a carpark's `source`) are
// common at call sites; JSON.stringify drops those keys from the payload.
type Props = Record<string, string | number | boolean | null | undefined>;

type Queued = { name: EventName; props?: Props; ts: string };

// ── Session ──────────────────────────────────────────────────────────────────

const SID_KEY = 'psg.sid';
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min, the usual analytics convention

type StoredSession = { id: string; ts: number };

function newSessionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * A rolling session id: the same id for as long as the user keeps interacting,
 * a fresh one after 30 minutes of inactivity. Kept in localStorage rather than
 * sessionStorage so a quick tab switch (or the PWA being backgrounded at a
 * carpark barrier) doesn't split one visit into two.
 */
function getSessionId(): string | null {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(SID_KEY);
    if (raw) {
      const prev = JSON.parse(raw) as StoredSession;
      if (prev?.id && typeof prev.ts === 'number' && now - prev.ts < SESSION_IDLE_MS) {
        localStorage.setItem(SID_KEY, JSON.stringify({ id: prev.id, ts: now }));
        return prev.id;
      }
    }
    const id = newSessionId();
    localStorage.setItem(SID_KEY, JSON.stringify({ id, ts: now }));
    return id;
  } catch {
    // Private mode / storage disabled: events still send, just unsessioned.
    return null;
  }
}

// ── Identity ─────────────────────────────────────────────────────────────────

let currentUserId: string | null = null;

/** Attach (or clear, on sign-out) the Google `sub` carried on later events. */
export function setEventUser(userId: string | null): void {
  currentUserId = userId;
}

// ── Buffer + flush ───────────────────────────────────────────────────────────

const MAX_BUFFER = 20; // well under the RPC's 50-row cap
const FLUSH_DEBOUNCE_MS = 4000;

let buffer: Queued[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function send(batch: Queued[]): void {
  if (!URL_BASE || !ANON_KEY || batch.length === 0) return;
  try {
    void fetch(`${URL_BASE}/rest/v1/rpc/record_events`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        p_events: batch,
        p_client_id: getClientId(),
        p_user_id: currentUserId,
        p_session_id: getSessionId(),
        p_device: getDevice(),
      }),
      // Survives the page being unloaded — critical for navigate_clicked,
      // which hands off to an external maps app.
      keepalive: true,
    }).catch(() => {
      /* best-effort */
    });
  } catch {
    /* best-effort */
  }
}

/** Send everything buffered right now. Safe to call at any time. */
export function flushEvents(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  send(batch);
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Flush whenever the page goes away. `visibilitychange` covers backgrounding
 * and tab switches; `pagehide` covers real navigations and the bfcache. Both
 * are needed — mobile Safari fires them inconsistently, and `beforeunload` is
 * unreliable on mobile entirely.
 */
function bindLifecycleFlush(): void {
  if (listenersBound || typeof document === 'undefined') return;
  listenersBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents();
  });
  window.addEventListener('pagehide', flushEvents);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Record one user action.
 *
 * Buffered by default. Pass `{ immediate: true }` for an action that is about
 * to take the user out of the app (navigating to a maps provider), where the
 * debounce window might not elapse.
 */
export function trackEvent(
  name: EventName,
  props?: Props,
  opts?: { immediate?: boolean },
): void {
  bindLifecycleFlush();
  buffer.push({ name, props, ts: new Date().toISOString() });
  if (opts?.immediate || buffer.length >= MAX_BUFFER) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

// One app_open per page load — guards against React StrictMode's double-mount
// in dev, mirroring the `visitRecorded` latch in analytics.ts.
let openRecorded = false;

/** Funnel step 1. Call once, alongside `recordVisit()`. */
export function trackAppOpen(entry?: string): void {
  if (openRecorded) return;
  openRecorded = true;
  trackEvent('app_open', entry ? { entry } : undefined);
}

// ── Delegated click tracking ─────────────────────────────────────────────────
//
// The funnel events above are hand-placed because their ORDER carries meaning.
// This is the complement: a single listener that records every control the user
// actually presses, so the dashboard can answer the opposite question — which
// features is nobody touching?
//
// Automatic rather than per-button on purpose. 89 buttons hand-instrumented
// would drift the moment someone adds the 90th; a delegated listener covers
// new UI for free.

/** The screen the user is on, stamped onto every click for context. */
let currentScreen = 'unknown';

export function setCurrentScreen(screen: string): void {
  currentScreen = screen;
}

/**
 * Identify the pressed control.
 *
 * ONLY `data-track` is read. The earlier version fell back to aria-label and
 * then innerText, which silently captured personal data: SavedFeedRow labels
 * its remove button `Remove ${destination.name}` (the user's own free-text
 * name for a place), and PlaceAutocomplete's suggestion rows have no
 * accessible name, so innerText yielded the street address the user was
 * navigating to. Both were being stored against a client id and a Google sub.
 *
 * Reading an explicit opt-in attribute makes that impossible by construction
 * rather than by redaction, and has two other benefits: the label is a stable
 * feature id rather than live UI text, and controls that are not features
 * (Leaflet marks its map pins role="button") drop out instead of becoming
 * top-ranked noise.
 *
 * The cost is that a control must be tagged to be counted. That is the right
 * trade: the question is "which FEATURES go unused", and a feature worth
 * measuring is worth naming. See src/lib/featureInventory.ts for the roster.
 */
function describeTarget(el: Element): string | null {
  const tracked = el.getAttribute('data-track');
  if (!tracked) return null;
  const clean = tracked.trim();
  // Must match the DB's own guard shape: short, lowercase, no user content.
  return /^[a-z][a-z0-9_]{0,39}$/.test(clean) ? clean : null;
}

let clickTrackingBound = false;

/**
 * Record every button/link press as `ui_click`. Call once at app start.
 *
 * Capture phase, so a handler that stops propagation (several sheets do)
 * cannot hide the interaction from analytics.
 */
export function initClickTracking(): void {
  if (clickTrackingBound || typeof document === 'undefined') return;
  clickTrackingBound = true;

  document.addEventListener(
    'click',
    (ev) => {
      const start = ev.target as Element | null;
      if (!start || typeof start.closest !== 'function') return;

      // Only opted-in controls, or a child of one (an icon inside a button).
      const el = start.closest('[data-track]');
      if (!el) return;

      const target = describeTarget(el);
      if (!target) return;

      trackEvent('ui_click', { target, screen: currentScreen });
    },
    { capture: true, passive: true },
  );
}
