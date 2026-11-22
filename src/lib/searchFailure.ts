/**
 * Why a search ended without a list. A failed lookup used to fall through to
 * the "No carparks nearby" screen, which reads as "this area has no parking"
 * when the truth was "we couldn't check". These are told apart here, shown
 * with their own copy and logged as `search_failed`.
 *
 * A failure is never shown as zero lots, "Full" or a made-up rate: nothing is
 * listed at all.
 */
export type SearchFailure =
  /** The address lookup itself failed (network, OneMap down). */
  | 'place_lookup'
  /** The address lookup worked and found no such place. */
  | 'place_not_found'
  /** The place resolved, but the carpark list could not be loaded. */
  | 'carparks'
  /** Anything else that threw. */
  | 'unknown';

export type FailureCopy = {
  title: string;
  body: string;
  /** False when trying the same search again cannot help. */
  canRetry: boolean;
};

export function failureCopy(failure: SearchFailure, query: string): FailureCopy {
  const place = query.trim();
  switch (failure) {
    case 'place_not_found':
      return {
        title: "Couldn't find that place",
        body: place
          ? `Nothing in Singapore matched “${place}”. Check the spelling, or try a postcode or a nearby mall.`
          : 'Nothing in Singapore matched that search. Try a postcode or a nearby mall.',
        canRetry: false,
      };
    case 'place_lookup':
      return {
        title: "Couldn't look up that place",
        body: 'The address search did not respond. Check your connection and try again.',
        canRetry: true,
      };
    case 'carparks':
      return {
        title: "Couldn't load carparks",
        body: place
          ? `We found ${place} but could not load the carparks around it. This is usually temporary.`
          : 'The carpark list could not be loaded. This is usually temporary.',
        canRetry: true,
      };
    default:
      return {
        title: 'Something went wrong',
        body: 'The search did not finish. Check your connection and try again.',
        canRetry: true,
      };
  }
}

/**
 * Runs `fn`, and once more after a short pause if it throws. For the two
 * calls a search cannot do without (address lookup, carpark list), where one
 * dropped request should not dead-end the search.
 */
export async function retryOnce<T>(fn: () => Promise<T>, delayMs = 400): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fn();
  }
}
