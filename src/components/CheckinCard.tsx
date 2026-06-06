import { useEffect, useRef, useState } from 'react';
import type { User } from '../lib/types';
import { IconCheck } from './icons';
import {
  type CheckinStatus,
  type CheckinSummary,
  fetchCheckinSummary,
  submitCheckin,
} from '../lib/api/checkins';

const STATUS_META: Record<
  CheckinStatus,
  { label: string; short: string; colorVar: string }
> = {
  available: { label: 'Lots available', short: 'Available', colorVar: '--ok' },
  limited: { label: 'Filling up', short: 'Limited', colorVar: '--warn' },
  full: { label: 'Full', short: 'Full', colorVar: '--bad' },
};

const ORDER: CheckinStatus[] = ['available', 'limited', 'full'];

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

/**
 * Crowdsourced "is it full right now?" — shows the recent community signal and
 * lets a signed-in driver report the current state. Especially useful for
 * carparks with no live sensor feed (where `hasSensor` is false).
 */
export function CheckinCard({
  carparkId,
  user,
  onRequireSignIn,
  hasSensor,
}: {
  carparkId: string;
  user: User | null;
  onRequireSignIn: () => void;
  hasSensor: boolean;
}) {
  const [summary, setSummary] = useState<CheckinSummary | null>(null);
  const [submitting, setSubmitting] = useState<CheckinStatus | null>(null);
  const [thanked, setThanked] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const ac = new AbortController();
    void fetchCheckinSummary(carparkId, ac.signal).then((s) => {
      if (mounted.current) setSummary(s);
    });
    return () => {
      mounted.current = false;
      ac.abort();
    };
  }, [carparkId]);

  const report = async (status: CheckinStatus) => {
    if (!user) {
      onRequireSignIn();
      return;
    }
    setSubmitting(status);
    const ok = await submitCheckin(carparkId, status, user.id);
    if (!mounted.current) return;
    setSubmitting(null);
    if (ok) {
      setThanked(true);
      const fresh = await fetchCheckinSummary(carparkId);
      if (mounted.current && fresh) setSummary(fresh);
    }
  };

  const latest = summary?.latestStatus ?? null;
  const total = summary?.total ?? 0;

  return (
    <div
      style={{
        marginTop: 16,
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line)',
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.2 }}>
          {hasSensor ? 'Is it full right now?' : 'How full is it now?'}
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Community
        </span>
      </div>

      {/* Recent crowd signal */}
      {latest && total > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: `var(${STATUS_META[latest].colorVar})`, flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, color: 'var(--text-1)', fontWeight: 600 }}>
            Drivers say: {STATUS_META[latest].label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            · {total} {total === 1 ? 'report' : 'reports'}
            {summary?.latestAt ? ` · ${timeAgo(summary.latestAt)}` : ''}
          </span>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 9, lineHeight: 1.45 }}>
          {hasSensor
            ? 'No recent community reports. Seen the lots? Add yours.'
            : 'No live sensor here — community reports are the only live signal. Be the first.'}
        </div>
      )}

      {/* Report buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {ORDER.map((s) => {
          const m = STATUS_META[s];
          const busy = submitting === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => void report(s)}
              disabled={submitting !== null}
              style={{
                appearance: 'none',
                flex: 1,
                padding: '9px 6px',
                borderRadius: 10,
                border: `0.5px solid color-mix(in srgb, var(${m.colorVar}) 45%, transparent)`,
                background: `color-mix(in srgb, var(${m.colorVar}) 10%, transparent)`,
                color: `var(${m.colorVar})`,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: submitting !== null ? 'default' : 'pointer',
                opacity: submitting !== null && !busy ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: `var(${m.colorVar})` }} />
              {busy ? '…' : m.short}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 9, display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1.4 }}>
        {thanked ? (
          <>
            <span style={{ color: 'var(--ok)', display: 'inline-flex' }}>
              <IconCheck size={12} stroke={2.5} />
            </span>
            Thanks — your report helps other drivers.
          </>
        ) : user ? (
          'Tap to report what you see. One report per carpark every 10 min.'
        ) : (
          'Sign in to report — tap a status to continue.'
        )}
      </div>
    </div>
  );
}
