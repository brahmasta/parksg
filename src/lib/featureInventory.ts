/**
 * The roster of user-facing features worth measuring.
 *
 * Each entry's `id` is the `data-track` attribute on the control that triggers
 * it, and the delegated click tracker in lib/api/events.ts records ONLY these
 * ids — it reads `data-track` and nothing else, so no UI text or user content
 * can leak into analytics.
 *
 * The admin dashboard joins this roster against the click counts coming back
 * from `admin_event_analytics.ui_clicks`. That join is the whole point: a
 * ranked list of what people press can only show what IS used, and the
 * question is which features are NOT. An entry here with zero clicks is a
 * concrete, named answer.
 *
 * Adding a feature: add the entry here, put the matching `data-track` on the
 * control, done — no migration, no dashboard change.
 */

export type FeatureArea =
  | 'Navigation'
  | 'Search'
  | 'Results'
  | 'Stay planner'
  | 'Carpark detail'
  | 'Saved'
  | 'Account'
  | 'Contribute';

export type Feature = {
  /** The `data-track` value. Must match /^[a-z][a-z0-9_]{0,39}$/. */
  id: string;
  /** Human-readable name for the admin dashboard. */
  label: string;
  area: FeatureArea;
};

export const FEATURES: Feature[] = [
  // Navigation / shell
  { id: 'nav_find_parking', label: 'Find parking (nav)', area: 'Navigation' },
  { id: 'nav_saved', label: 'Saved (nav)', area: 'Navigation' },
  { id: 'nav_add_carpark', label: 'Add carpark (nav)', area: 'Navigation' },
  { id: 'nav_about', label: 'About (nav)', area: 'Navigation' },
  { id: 'nav_account', label: 'Account (nav)', area: 'Navigation' },
  { id: 'nav_home_wordmark', label: 'Wordmark → home', area: 'Navigation' },
  { id: 'nav_back', label: 'Back', area: 'Navigation' },

  // Search
  { id: 'search_near_me', label: 'Use my location', area: 'Search' },
  { id: 'search_submit', label: 'Search (button)', area: 'Search' },
  { id: 'search_clear', label: 'Clear search', area: 'Search' },
  { id: 'search_suggestion', label: 'Pick a suggestion', area: 'Search' },
  { id: 'add_destination', label: 'Add a destination', area: 'Search' },
  { id: 'saved_dest_chip', label: 'Saved destination chip', area: 'Search' },
  { id: 'saved_carpark_chip', label: 'Saved carpark chip', area: 'Search' },
  { id: 'recent_dest_chip', label: 'Recent destination chip', area: 'Search' },
  { id: 'recents_see_all', label: 'See all recents', area: 'Search' },
  { id: 'add_destination_submit', label: 'Save a destination', area: 'Search' },

  // Results
  { id: 'result_card_open', label: 'Open a result', area: 'Results' },
  { id: 'filter_ev', label: 'EV filter', area: 'Results' },
  { id: 'filter_available_only', label: 'Available-only filter', area: 'Results' },
  { id: 'sort_carparks', label: 'Change sort', area: 'Results' },
  { id: 'view_mode_list', label: 'List view', area: 'Results' },
  { id: 'view_mode_map', label: 'Map view', area: 'Results' },

  // Stay planner
  { id: 'stay_planner_toggle', label: 'Open stay planner', area: 'Stay planner' },
  { id: 'stay_mode_change', label: 'Park now / arrive at', area: 'Stay planner' },
  { id: 'stay_duration_step', label: 'Step duration ±30m', area: 'Stay planner' },
  { id: 'stay_duration_preset', label: 'Duration preset', area: 'Stay planner' },

  // Carpark detail
  { id: 'detail_navigate', label: 'Navigate', area: 'Carpark detail' },
  { id: 'detail_choose_nav_app', label: 'Choose navigation app', area: 'Carpark detail' },
  { id: 'detail_nav_provider', label: 'Pick a maps provider', area: 'Carpark detail' },
  { id: 'detail_share', label: 'Share carpark', area: 'Carpark detail' },
  { id: 'detail_save', label: 'Save carpark', area: 'Carpark detail' },
  { id: 'checkin_submit', label: 'Report availability', area: 'Carpark detail' },
  { id: 'ev_connector_expand', label: 'Expand EV connector', area: 'Carpark detail' },

  // Saved
  { id: 'saved_open', label: 'Open a saved item', area: 'Saved' },
  { id: 'saved_remove', label: 'Remove a saved item', area: 'Saved' },

  // Account
  { id: 'sign_in', label: 'Sign in', area: 'Account' },
  { id: 'sign_out', label: 'Sign out', area: 'Account' },
  { id: 'install_accept', label: 'Install the PWA', area: 'Account' },
  { id: 'install_dismiss', label: 'Dismiss install prompt', area: 'Account' },

  // Contribute
  { id: 'report_inaccuracy', label: 'Report an inaccuracy', area: 'Contribute' },
  { id: 'suggest_edit', label: 'Suggest an edit', area: 'Contribute' },
  { id: 'add_carpark_submit', label: 'Submit a new carpark', area: 'Contribute' },
  { id: 'report_inaccuracy_submit', label: 'Send an inaccuracy report', area: 'Contribute' },
  { id: 'suggest_edit_submit', label: 'Send a suggested edit', area: 'Contribute' },
  { id: 'feedback_link', label: 'Send feedback on X', area: 'Contribute' },
];

/** Lookup by `data-track` id. */
export const FEATURE_BY_ID: Record<string, Feature> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f]),
);

/** Phrase a tracking age the same way everywhere it is shown. */
export function formatTrackingAge(hours: number | null | undefined): string {
  if (hours == null) return 'not started';
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}
