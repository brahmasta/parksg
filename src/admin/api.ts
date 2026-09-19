/** Client helpers + types for the /admin control panel. */

export type Analytics = {
  window_days: number;
  totals: {
    registered_users: number;
    visits: number;
    active_users: number;
    searches: number;
    searches_all_time: number;
    reports_open: number;
    checkins: number;
  };
  dau: { day: string; users: number }[];
  searches_by_day: { day: string; count: number }[];
  device: { device: string; count: number }[];
  referrers: { referrer: string; count: number }[];
  top_searches: { query: string; count: number }[];
};

/**
 * The traffic audit (/api/admin/traffic) — see db/migrations/009.
 *
 * Clients are split three ways rather than human-vs-bot, because a chunk of
 * traffic is genuinely ambiguous: someone who taps a Google result, reads a
 * carpark's rate and leaves looks identical to a crawler, and for this app that
 * visit is a success, not a bounce. Forcing it into either bucket would be a
 * guess presented as a fact.
 *
 * Every field the dashboard reads is optional and defaulted at the call site.
 * SQL is applied by hand while the SPA auto-deploys on push, so the client can
 * briefly be newer than the function — an un-migrated DB must degrade to a
 * missing number, not a crash that takes the whole admin panel down.
 */
export type DayPoint = { day: string; value: number };

export type Traffic = {
  window_days: number;
  first_day?: string;
  last_day?: string;
  /** Complete days in the window — today is excluded from every average. */
  complete_days?: number;
  /** First app_events row; the funnel can only speak from here onward. */
  instrumented_since?: string | null;

  /** Real people: reached the home screen, returned, signed in, or acted. */
  people?: {
    clients: number;
    engaged: number;
    avg_dau: number | null;
    avg_visits: number | null;
    avg_searches: number | null;
    total_visits: number;
    total_searches: number;
  };
  /** Crawler signature: direct + deep path only + one visit + no human signal. */
  bots?: {
    clients: number;
    avg_dau: number | null;
    avg_visits: number | null;
    total_visits: number;
  };
  /** Neither — mostly search-engine deep landings. Never silently merged. */
  uncertain?: { clients: number; total_visits: number };

  /** Unclassified totals, so the three buckets always reconcile. */
  totals?: { clients: number; page_loads: number; searches: number; events: number };

  series?: {
    people_dau: DayPoint[];
    people_visits: DayPoint[];
    people_searches: DayPoint[];
    bot_visits: DayPoint[];
  };

  sources: {
    source: 'search_engine' | 'direct' | 'ai_assistant' | 'social' | 'internal' | 'other';
    clients: number;
    visits: number;
    person?: number;
    automated?: number;
    uncertain?: number;
    searched: number;
    pct_person_searched?: number;
  }[];

  funnel: { step: number; label: string; clients: number; pct: number }[];
  /** What the funnel is measured over, so the UI never implies that
   *  un-instrumented clients abandoned. */
  funnel_basis?: {
    cohort: number;
    since: string | null;
    direct_to_carpark: number;
    direct_to_navigate: number;
  };

  return_7d: { eligible: number; returned: number; pct: number };
  device: { device: string; person?: number; automated?: number; uncertain?: number }[];

  events: {
    totals: { events: number; clients: number; sessions: number };
    funnel: { step: number; name: string; label: string; clients: number; pct_of_top: number }[];
    ui_clicks: {
      target: string;
      screen: string;
      count: number;
      clients: number;
      last_seen?: string | null;
    }[];
    /** How long click tracking has actually been running. Without this, an
     *  unused feature and an unobserved one are indistinguishable. */
    tracking?: {
      first_event_at: string | null;
      first_click_at: string | null;
      ui_clicks: number;
      /** Hours since the first click, computed server-side — the server owns
       *  the clock, and Date.now() in a React render is impure. */
      hours_tracked?: number | null;
    };
    top_events: { name: string; count: number; clients: number }[];
    navigate_providers: { provider: string; count: number }[];
  } | null;
};

export type Report = {
  id: string;
  created_at: string;
  carpark_id: string | null;
  carpark_name: string;
  carpark_source: string | null;
  category: string;
  description: string;
  email: string | null;
  status: string;
};

/** A community-proposed carpark edit ('edit') or brand-new carpark ('new')
 * awaiting moderation. */
export type EditSubmission = {
  id: string;
  created_at: string;
  kind: 'edit' | 'new';
  carpark_id: string | null;
  carpark_name: string | null;
  carpark_source: string | null;
  proposed_carpark: { name?: string; lat?: number; lng?: number; address?: string } | null;
  submitter_user_id: string | null;
  submitter_email: string | null;
  submitter_name: string | null;
  proposed_total_lots: number | null;
  proposed_rates: RateRow[];
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type RateRow = {
  id?: number;
  day_type: 'WEEKDAY' | 'SAT' | 'SUN_PH';
  start_time: string | null;
  end_time: string | null;
  first_hour_cents: number | null;
  per_block_cents: number | null;
  block_minutes: number | null;
  per_entry_cents: number | null;
  cap_cents: number | null;
  grace_minutes: number | null;
  system: string;
  veh_cat: string;
  source: string;
  effective_from: string | null;
};

export type CarparkLite = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  agency: string;
  total_lots: number | null;
  lat: number | null;
  lng: number | null;
  central_area: boolean;
  car_park_type: string | null;
};

export type CarparkFull = CarparkLite & {
  source: string;
  source_code: string;
  parking_system: string;
  rate_rows: RateRow[];
};

export class AdminError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Fetch an admin endpoint with the Google access token; throws AdminError. */
export async function adminFetch<T>(
  path: string,
  token: string,
  opts?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(opts?.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(opts?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new AdminError(res.status, msg);
  }
  return (await res.json()) as T;
}
