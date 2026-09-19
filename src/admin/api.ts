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
 * The traffic audit (/api/admin/traffic).
 *
 * `populations` deliberately reports several different denominators side by
 * side, because "active users" was previously a single number that conflated
 * crawlers indexing the SSR/SEO routes with real people. See db migration 007.
 */
export type Traffic = {
  window_days: number;
  populations: {
    /** Every distinct client_id that loaded a page — the OLD "active users". */
    visitors: number;
    /** Direct + deep-path + single-visit + never interacted. Almost all bots. */
    likely_automated: number;
    /** visitors - likely_automated. */
    humans: number;
    /** Humans who searched or took any in-app action. The honest number. */
    engaged: number;
    page_loads: number;
    human_page_loads: number;
    searches: number;
    distinct_searchers: number;
  };
  sources: {
    source: 'search_engine' | 'direct' | 'ai_assistant' | 'social' | 'internal' | 'other';
    clients: number;
    visits: number;
    automated: number;
    human: number;
    searched: number;
    pct_human_searched: number;
  }[];
  funnel: { step: number; label: string; clients: number; pct: number }[];
  return_7d: { eligible: number; returned: number; pct: number };
  device: { device: string; human: number; automated: number }[];
  /** null when the event RPC fails; empty-but-valid before instrumented traffic lands. */
  events: {
    totals: { events: number; clients: number; sessions: number };
    funnel: { step: number; name: string; label: string; clients: number; pct_of_top: number }[];
    top_events: { name: string; count: number; clients: number }[];
    /** Every control the delegated click tracker saw. What is ABSENT from this
     *  list is the point: an unlisted feature is one nobody is using. */
    ui_clicks: { target: string; screen: string; count: number; clients: number }[];
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
