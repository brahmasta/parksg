/**
 * Parser for the free-text rate strings in the data.gov.sg "LTA Carpark
 * Rates" dataset (d_9f6056bdb6b1dfba57f063593e4f34ae).
 *
 * The corpus is hand-written and inconsistent; common forms include:
 *
 *   "Free"
 *   "$3 per entry"
 *   "$1.20 / 30 min"
 *   "$1.20 for 1st hr; $0.60 for sub. 30 mins"
 *   "7am-6pm: $1.20 for 1st hr; $0.60 for sub 30 mins. 6pm-3.30am: $3 per entry"
 *   "Mon-Fri 7am-6pm: $1 for 1st hr, $0.60 sub 30 mins. 6pm-7am: $3 per entry"
 *   "$10 max per day"
 *
 * Strategy: split on segment separators (";", ".") into one or more bands.
 * For each band, look for:
 *   - an optional time window  ("7am-6pm")
 *   - first-hour cents          ("$1.20 for 1st hr")
 *   - subsequent block          ("$0.60 for sub. 30 mins")
 *   - per-entry charge          ("$3 per entry")
 *   - daily cap                 ("$8 max / day")
 *   - free                      ("Free")
 *
 * If a row matches none of these structurally, the parser returns null so
 * the caller can route the carpark to the unparsed pile rather than coerce
 * an ambiguous string into a wrong number.
 */

import type { RateRow, RateSource } from '../../src/lib/types';

export type ParseDayResult =
  | { ok: true; rows: RateRow[] }
  | { ok: false; reason: string };

const SOURCE: RateSource = 'LTA_DATAGOV';
const EFFECTIVE_FROM = '2018-11-01';

// ────────────────────────────────────────────────────────────────────
// Time parsing
// ────────────────────────────────────────────────────────────────────

/** Match "7am", "7.30am", "7:30 pm", "12noon", "12midnight", "12:00 mn", etc. */
const CLOCK = /(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|noon|midnight|mn)?/i;

export function parseClockToHHMM(token: string): string | null {
  const m = CLOCK.exec(token.trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = (m[3] ?? '').toLowerCase().replace(/\./g, '');

  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (min < 0 || min > 59) return null;

  if (meridiem === 'noon') {
    if (h !== 12 && h !== 0) return null;
    return '12:00';
  }
  if (meridiem === 'midnight' || meridiem === 'mn') {
    if (h !== 12 && h !== 0) return null;
    return '00:00';
  }

  if (meridiem === 'am' || meridiem === 'pm') {
    if (h < 1 || h > 12) return null;
    if (meridiem === 'am') {
      if (h === 12) h = 0; // 12am = 00:00
    } else {
      if (h !== 12) h += 12; // 12pm = 12:00, 1pm = 13:00
    }
  } else {
    // No meridiem — only accept 24h numeric times.
    if (h < 0 || h > 23) return null;
  }

  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Find a "<time> - <time>" window anywhere in the segment.
 * Returns { startTime, endTime } or null. endTime may be < startTime
 * (crosses midnight). */
export function parseTimeWindow(
  segment: string,
): { startTime: string; endTime: string } | null {
  // Accept en-dashes, em-dashes, hyphens, " to ".
  const re =
    /(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.|noon|midnight|mn)?)\s*(?:-|–|—|to)\s*(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.|noon|midnight|mn)?)/i;
  const m = re.exec(segment);
  if (!m) return null;
  const startTime = parseClockToHHMM(m[1]);
  const endTime = parseClockToHHMM(m[2]);
  if (!startTime || !endTime) return null;
  return { startTime, endTime };
}

// ────────────────────────────────────────────────────────────────────
// Money / amount parsing
// ────────────────────────────────────────────────────────────────────

/** Pull a dollar amount (e.g. "$1.20", "$3", "0.60") just after a marker. */
function extractCentsAfter(haystack: string, marker: RegExp): number | null {
  const m = marker.exec(haystack);
  if (!m) return null;
  const tail = haystack.slice(m.index);
  const dollarMatch = /\$?\s*(\d+(?:\.\d{1,2})?)/.exec(tail);
  if (!dollarMatch) return null;
  return toCents(parseFloat(dollarMatch[1]));
}

/** Pull a dollar amount immediately PRECEDING a marker. */
function extractCentsBefore(haystack: string, marker: RegExp): number | null {
  const m = marker.exec(haystack);
  if (!m) return null;
  const head = haystack.slice(0, m.index);
  // Take the LAST $X.XX before the marker.
  const matches = [...head.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)];
  if (matches.length === 0) {
    // Try without $ prefix
    const bare = [...head.matchAll(/(\d+(?:\.\d{1,2})?)\s*$/g)];
    if (bare.length === 0) return null;
    return toCents(parseFloat(bare[bare.length - 1][1]));
  }
  return toCents(parseFloat(matches[matches.length - 1][1]));
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// ────────────────────────────────────────────────────────────────────
// Segment parsing
// ────────────────────────────────────────────────────────────────────

type Segment = {
  rawWindow: string | null;
  rawBody: string;
};

/** Split a raw day-rate string into segments, each potentially with its
 * own time window. We split on ";" only — it's the reliable separator in
 * this dataset. Splitting on "." is too risky: "sub. 30 mins", "approx.",
 * decimal prices like "$1.20", and "a.m." all get mangled. Strings whose
 * bands are joined only by "." fall through to a single-segment parse,
 * and if that can't classify the whole body they route to unparsed. */
export function splitSegments(raw: string): Segment[] {
  // Apply the cheap whole-string typo fix here so the continuation-detection
  // regex below sees the canonical form. Other normalisations stay inside
  // classifyBody where they apply per-body.
  const text = raw.trim().replace(/\bfor\s+for\b/gi, 'for');
  if (!text) return [];

  const halves = text.split(/\s*;\s*/);
  const out: Segment[] = [];
  for (const half of halves) {
    const cleaned = half.trim().replace(/\.$/, '').trim();
    if (!cleaned) continue;
    const seg = extractWindow(cleaned);
    // Continuation pattern: a "$X for sub …" segment without its own window
    // belongs to the previous band's tiered rate. Merge it back so the body
    // becomes the canonical "$Y for 1st hr; $X for sub N mins" form that
    // classifyBody handles natively.
    const isContinuation =
      !seg.rawWindow &&
      /^\$?\s*\d+(?:\.\d{1,2})?\s*(?:for|per)?\s*sub(?:sequent)?\b/i.test(
        seg.rawBody,
      );
    if (isContinuation && out.length > 0) {
      const prev = out[out.length - 1];
      prev.rawBody = `${prev.rawBody}; ${seg.rawBody}`;
      continue;
    }
    out.push(seg);
  }
  return out;
}

function extractWindow(segment: string): Segment {
  // Try "<window>: <body>" — the common form.
  const colonPrefix = /^(.+?):\s*(.+)$/.exec(segment);
  if (colonPrefix) {
    const window = parseTimeWindow(colonPrefix[1]);
    if (window) {
      return { rawWindow: colonPrefix[1].trim(), rawBody: colonPrefix[2].trim() };
    }
  }
  // Try "<window> - <body>" — used by a handful of rows like
  // "12am-5.59pm - $1.07 for 1st hr". We require spaces on both sides of
  // the dash so we don't mistake the hyphen in "7am-6pm" itself.
  const dashPrefix = /^(.+?)\s+[-–—]\s+(.+)$/.exec(segment);
  if (dashPrefix) {
    const window = parseTimeWindow(dashPrefix[1]);
    if (window) {
      return { rawWindow: dashPrefix[1].trim(), rawBody: dashPrefix[2].trim() };
    }
  }
  // Try a parenthesized window anywhere in the segment.
  const paren = /\(([^)]*\d{1,2}[^)]*)\)/.exec(segment);
  if (paren) {
    const window = parseTimeWindow(paren[1]);
    if (window) {
      const body = segment.replace(paren[0], '').trim();
      return { rawWindow: paren[1].trim(), rawBody: body };
    }
  }
  return { rawWindow: null, rawBody: segment };
}

// ────────────────────────────────────────────────────────────────────
// Body classification
// ────────────────────────────────────────────────────────────────────

const FREE = /\bfree\b/i;
const PER_ENTRY = /per\s*entry/i;
/** Matches "1st hr", "1st 2 hrs", "first 2 hours". Capture group 1 = N (default 1). */
const FIRST_HOUR = /\b(?:1st|first)\s*(\d+)?\s*h(?:rs?|ours?)\b/i;
/** Matches "1st 30 mins" / "1st 15min" / "first 30 minutes". Capture group 1 = N. */
const FIRST_MINS = /\b(?:1st|first)\s*(\d+)\s*min(?:utes?|s?)?/i;
const SUB_BLOCK = /\bsub(?:sequent)?\.?\s*(\d+)\s*min(?:utes?|s?)?/i;
const PLAIN_BLOCK =
  /\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:per|\/|each|for)\s*(\d+)\s*min/i;
const PLAIN_PER_HOUR =
  /\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:per|\/|each)\s*h(?:r|our)/i;
const PLAIN_PER_MINUTE =
  /\$?\s*(\d+(?:\.\d{1,4})?)\s*(?:per|\/|each)\s*min(?!s|ute)\b/i;
/** "$X per car" appears at attractions like Sentosa — treat as per-entry. */
const PER_CAR = /per\s*car\b/i;
const MAX_DAY_AFTER = /(?:max(?:imum)?|cap)(?:[^$\d]{0,30})\$\s*(\d+(?:\.\d{1,2})?)/i;
const MAX_DAY_BEFORE = /\$\s*(\d+(?:\.\d{1,2})?)\s*(?:max(?:imum)?|cap)/i;

/** Normalise common variants in the corpus before regex matching:
 *   ½, 1/2, half hour → "30 mins"
 *   curly quotes / dashes → ASCII
 *   collapse double spaces
 */
function normalizeBody(body: string): string {
  return body
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    // "½ hour" / "1/2 hour" / "half hour" / "half an hour" → "30 mins"
    .replace(/(?:½|1\s*\/\s*2|half(?:\s*an)?)\s*-?\s*h(?:r|our)s?/gi, '30 mins')
    // "sub. hr" (no number) → implied 1-hour subsequent block.
    .replace(/\bsub(?:sequent)?\.?\s+h(?:r|our)s?\b/gi, 'sub. 60 mins')
    // Common typo: "for for" → "for"
    .replace(/\bfor\s+for\b/gi, 'for')
    // Standalone "½" near min context (rare but seen)
    .replace(/½/g, '0.5')
    .replace(/\s+/g, ' ')
    .trim();
}

type Classified = {
  firstHourCents?: number;
  /** Duration of the first tier in minutes (defaults to 60 if omitted). */
  firstBlockMinutes?: number;
  perBlockCents?: number;
  blockMinutes?: number;
  perEntryCents?: number;
  capCents?: number;
  isFree?: boolean;
};

/** Look for a "sub. N mins" continuation right after the first-tier marker
 * and attach perBlockCents + blockMinutes to `out`. */
function attachSubBlock(out: Classified, body: string, tierRegex: RegExp): void {
  const sub = SUB_BLOCK.exec(body);
  if (!sub) return;
  const blockMinutes = parseInt(sub[1], 10);
  const fromIdx = body.search(tierRegex);
  const subTail = fromIdx >= 0 ? body.slice(fromIdx) : body;
  const perBlockCents = extractCentsBefore(subTail, SUB_BLOCK);
  if (perBlockCents != null && Number.isFinite(blockMinutes)) {
    out.perBlockCents = perBlockCents;
    out.blockMinutes = blockMinutes;
  }
}

export function classifyBody(rawBody: string): Classified | null {
  const body = normalizeBody(rawBody);
  const out: Classified = {};
  let matched = false;

  // 1. Free
  if (FREE.test(body) && !/\$|per\s*entry|\d+\s*min/i.test(body)) {
    return { isFree: true };
  }

  // 2a. First tier in HOURS ("1st hr", "1st 2 hrs") + optional sub block.
  const firstMatch = FIRST_HOUR.exec(body);
  if (firstMatch) {
    const firstHourCents = extractCentsBefore(body, FIRST_HOUR);
    if (firstHourCents != null) {
      out.firstHourCents = firstHourCents;
      const nHours = firstMatch[1] ? parseInt(firstMatch[1], 10) : 1;
      if (Number.isFinite(nHours) && nHours >= 1) {
        out.firstBlockMinutes = nHours * 60;
      }
      matched = true;
      attachSubBlock(out, body, FIRST_HOUR);
    }
  } else {
    // 2b. First tier in MINUTES ("1st 30 mins") + optional sub block.
    const firstMin = FIRST_MINS.exec(body);
    if (firstMin) {
      const firstHourCents = extractCentsBefore(body, FIRST_MINS);
      if (firstHourCents != null) {
        out.firstHourCents = firstHourCents;
        const nMins = parseInt(firstMin[1], 10);
        if (Number.isFinite(nMins) && nMins > 0) {
          out.firstBlockMinutes = nMins;
        }
        matched = true;
        attachSubBlock(out, body, FIRST_MINS);
      }
    }
  }

  // 3. Plain "$X / N min" form (no first-hour tier)
  if (out.perBlockCents == null) {
    const plain = PLAIN_BLOCK.exec(body);
    if (plain) {
      out.perBlockCents = toCents(parseFloat(plain[1]));
      out.blockMinutes = parseInt(plain[2], 10);
      matched = true;
    } else if (out.firstHourCents == null) {
      // Only check the looser "per hr" / "per min" patterns when there's
      // no first-hour tier, else the tier cents would double-match.
      const ph = PLAIN_PER_HOUR.exec(body);
      if (ph) {
        out.perBlockCents = toCents(parseFloat(ph[1]));
        out.blockMinutes = 60;
        matched = true;
      } else {
        const pm = PLAIN_PER_MINUTE.exec(body);
        if (pm) {
          out.perBlockCents = toCents(parseFloat(pm[1]));
          out.blockMinutes = 1;
          matched = true;
        }
      }
    }
  }

  // 4. Per-entry (also accept "$X per car" used at attractions)
  const perEntryCents =
    extractCentsBefore(body, PER_ENTRY) ?? extractCentsBefore(body, PER_CAR);
  if (perEntryCents != null) {
    out.perEntryCents = perEntryCents;
    matched = true;
  }

  // 5. Cap / max — accept either "max $X" or "$X max" forms.
  const capMatch = MAX_DAY_AFTER.exec(body) ?? MAX_DAY_BEFORE.exec(body);
  if (capMatch) {
    out.capCents = toCents(parseFloat(capMatch[1]));
    matched = true;
  }

  return matched ? out : null;
}

// ────────────────────────────────────────────────────────────────────
// Display strings (for the cosmetic window/rate fields)
// ────────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function renderWindow(
  startTime: string | undefined,
  endTime: string | undefined,
  fallback: string,
): string {
  if (!startTime || !endTime) return fallback || 'All day';
  return `${humanTime(startTime)} – ${humanTime(endTime)}`;
}

function humanTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const meridiem = h < 12 || h === 24 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${meridiem}` : `${h12}:${String(m).padStart(2, '0')}${meridiem}`;
}

function renderRate(c: Classified): string {
  if (c.isFree) return 'Free';
  const parts: string[] = [];
  if (c.firstHourCents != null) parts.push(`${fmtCents(c.firstHourCents)} / 1st hr`);
  if (c.perBlockCents != null && c.blockMinutes != null) {
    parts.push(`${fmtCents(c.perBlockCents)} / ${c.blockMinutes} min`);
  }
  if (c.perEntryCents != null) parts.push(`${fmtCents(c.perEntryCents)} / entry`);
  return parts.join(' · ') || 'See operator';
}

// ────────────────────────────────────────────────────────────────────
// Public entry point — parse one day-type string into rows
// ────────────────────────────────────────────────────────────────────

export function parseDayRate(raw: string | null | undefined): ParseDayResult {
  const text = (raw ?? '').trim();
  if (!text) return { ok: true, rows: [] };

  // Treat common opaque-no-data values as "no rate". Note: "Same as X"
  // deferrals are resolved by the ingestion script BEFORE this is called,
  // so by the time we see them here they're already substituted.
  if (
    /^(n\.?a\.?|nil|na|-|closed|hdb\s+coupon(?:\s+parking)?|coupon\s+parking|operator\s+parking|season\s+parking\s+only|carpark\s+not\s+in\s+use)$/i.test(
      text,
    )
  ) {
    return { ok: true, rows: [] };
  }

  // Whole-string "Free" shortcut.
  if (/^free$/i.test(text)) {
    return {
      ok: true,
      rows: [
        {
          window: 'All day',
          rate: 'Free',
          source: SOURCE,
          effectiveFrom: EFFECTIVE_FROM,
        },
      ],
    };
  }

  const segments = splitSegments(text);
  if (segments.length === 0) return { ok: false, reason: 'empty after split' };

  const rows: RateRow[] = [];
  for (const seg of segments) {
    const classified = classifyBody(seg.rawBody);
    if (!classified) {
      return { ok: false, reason: `cannot classify body: ${JSON.stringify(seg.rawBody)}` };
    }
    const window = seg.rawWindow ? parseTimeWindow(seg.rawWindow) : null;
    const startTime = window?.startTime;
    const endTime = window?.endTime;

    const capCents = classified.capCents;
    const cap = capCents != null ? `${fmtCents(capCents)} cap` : undefined;

    rows.push({
      window: renderWindow(startTime, endTime, seg.rawWindow ?? ''),
      rate: renderRate(classified),
      cap,
      startTime,
      endTime,
      firstHourCents: classified.firstHourCents,
      firstBlockMinutes: classified.firstBlockMinutes,
      perBlockCents: classified.perBlockCents,
      blockMinutes: classified.blockMinutes,
      perEntryCents: classified.perEntryCents,
      capCents,
      source: SOURCE,
      effectiveFrom: EFFECTIVE_FROM,
    });
  }

  return { ok: true, rows };
}

// ────────────────────────────────────────────────────────────────────
// Cost estimation from structured rows
// ────────────────────────────────────────────────────────────────────

/**
 * Compute an estimated cost in cents for a stay of `hours` starting at
 * the band's startTime (or at 09:00 if unbanded). Used by the runtime
 * cost calculator to rank LTA_DATAGOV carparks alongside HDB/URA.
 *
 * Heuristic: pick the first row whose band covers a typical daytime
 * arrival; charge first-hour + remaining-minutes/blockMinutes blocks;
 * or perEntryCents flat; or 0 if free. Cap at capCents if present.
 *
 * This is intentionally simple — the data has too many edge cases
 * (multi-tier with different blocks per tier, holiday surcharges, etc.)
 * to be exact. We over-estimate slightly so users aren't surprised at
 * the gantry.
 */
export function estimateCostCents(rows: RateRow[], hours: number): number | null {
  if (rows.length === 0) return null;
  // Prefer the first row that has structured rate info; otherwise use the first row.
  const row =
    rows.find(
      (r) =>
        r.perBlockCents != null ||
        r.perEntryCents != null ||
        r.firstHourCents != null,
    ) ?? rows[0];

  let cents = 0;
  if (row.perEntryCents != null && row.perBlockCents == null && row.firstHourCents == null) {
    cents = row.perEntryCents;
  } else if (row.perBlockCents != null && row.blockMinutes != null) {
    const totalMinutes = Math.ceil(hours * 60);
    if (row.firstHourCents != null) {
      const firstBlockMin = row.firstBlockMinutes ?? 60;
      cents += row.firstHourCents;
      const remain = Math.max(0, totalMinutes - firstBlockMin);
      cents += Math.ceil(remain / row.blockMinutes) * row.perBlockCents;
    } else {
      cents += Math.ceil(totalMinutes / row.blockMinutes) * row.perBlockCents;
    }
  } else if (row.firstHourCents != null) {
    // First hour rate only — extrapolate for longer stays.
    cents = row.firstHourCents * Math.max(1, Math.ceil(hours));
  } else {
    // No structured info — can't estimate.
    return null;
  }
  if (row.capCents != null && cents > row.capCents) cents = row.capCents;
  return cents;
}
