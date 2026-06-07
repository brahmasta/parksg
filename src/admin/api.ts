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
