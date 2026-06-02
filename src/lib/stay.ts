// Planned-stay model — a start time (Now / Later) and a duration the user dials
// in 30-minute steps, hard-capped at 24h. Drives every cost estimate: unlike the
// 6 preset durations, the stay can be any 0.5h step, so costs are priced from
// the structured rate rows via estimateCostCentsAt at the stay's start time.

import type { Carpark, RateRow } from './types';
import { estimateCostCentsAt } from './rateMath';
import { currentDayType } from './uraJoin';

export type StartMode = 'now' | 'later';
export type Stay = { startMode: StartMode; startAt: Date; hours: number };

export const STAY_MIN_HOURS = 0.5;
export const STAY_MAX_HOURS = 24;

/** Clamp to [0.5, 24] and snap to the nearest 0.5h step. */
export function clampHours(hours: number): number {
  const snapped = Math.round(hours * 2) / 2;
  return Math.max(STAY_MIN_HOURS, Math.min(STAY_MAX_HOURS, snapped));
}

/** The concrete start instant — `now` resolves live each call. */
export function effectiveStart(stay: Stay): Date {
  return stay.startMode === 'now' ? new Date() : stay.startAt;
}

/** A sensible "Later" seed: ~1h out, rounded to the next :00/:30. */
export function roundedSoon(now: Date = new Date()): Date {
  const d = new Date(now.getTime() + 60 * 60000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 0);
  if (d.getMinutes() === 0 && now.getMinutes() >= 30) d.setHours(d.getHours() + 1);
  return d;
}

// ── Formatters ──────────────────────────────────────────────────────────

export function fmtDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function fmtClock(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function fmtDay(date: Date, now: Date = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Cost for an arbitrary stay ────────────────────────────────────────────

/**
 * Estimated cost in dollars for parking `cp` over the planned stay, priced at
 * the stay's start day/hour. Returns null when the rate is unknown (Google
 * supplementary carparks). Falls back to the carpark's flat per-30-min estimate
 * (derived from its preset estByHours) when the structured rows can't price it.
 */
export function estCostForStay(cp: Carpark, stay: Stay): number | null {
  if (cp.rateUnknown) return null;
  const start = effectiveStart(stay);
  const at = { dayType: currentDayType(start), hourOfDay: start.getHours() };
  const rows: RateRow[] = [...cp.rates.weekday, ...cp.rates.saturday, ...cp.rates.sundayPH];
  const cents = estimateCostCentsAt(rows, stay.hours, at);
  if (cents != null) return +(cents / 100).toFixed(2);
  // Fallback: extrapolate the preset per-30-min rate across the stay.
  const perHalfHour = cp.estByHours[0.5] ?? 0;
  return +(Math.ceil(stay.hours * 2) * perHalfHour).toFixed(2);
}
