import { useCallback, useEffect, useState } from 'react';
import { adminFetch, AdminError, type EditSubmission, type RateRow, type CarparkFull } from './api';

const STATUSES = ['pending', 'approved', 'rejected'];
const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--accent)',
  approved: 'var(--ok)',
  rejected: 'var(--text-3)',
};

const card: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '0.5px solid var(--line-strong)',
  borderRadius: 14,
  padding: 16,
  boxShadow: 'var(--shadow-card)',
};

const d = (c: number | null | undefined) => (c == null ? '—' : `$${(c / 100).toFixed(2)}`);

/** Concise one-line summary of a rate band. */
function fmtRate(r: RateRow): string {
  const when = `${r.day_type}${r.start_time || r.end_time ? ` ${r.start_time ?? ''}–${r.end_time ?? ''}` : ''}`;
  const parts: string[] = [];
  if (r.first_hour_cents != null) parts.push(`1st hr ${d(r.first_hour_cents)}`);
  if (r.per_block_cents != null) parts.push(`${d(r.per_block_cents)}/${r.block_minutes ?? '?'}m`);
  if (r.per_entry_cents != null) parts.push(`entry ${d(r.per_entry_cents)}`);
  if (r.cap_cents != null) parts.push(`cap ${d(r.cap_cents)}`);
  if (r.grace_minutes != null) parts.push(`${r.grace_minutes}m grace`);
  return `${when}: ${parts.join(' · ') || 'free'}`;
}

function RateList({ title, rows, muted }: { title: string; rows: RateRow[]; muted?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-3)', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No rate rows.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ fontSize: 12.5, color: muted ? 'var(--text-3)' : 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>{fmtRate(r)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({
  sub,
  token,
  onAuthError,
  onActed,
}: {
  sub: EditSubmission;
  token: string;
  onAuthError: () => void;
  onActed: (id: string, status: string) => void;
}) {
  const [current, setCurrent] = useState<CarparkFull | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load the carpark's current state for the diff.
  useEffect(() => {
    let alive = true;
    adminFetch<{ carpark: CarparkFull }>(`/api/admin/carparks?id=${encodeURIComponent(sub.carpark_id)}`, token)
      .then((d2) => alive && setCurrent(d2.carpark))
      .catch((e: AdminError) => (e.status === 401 ? onAuthError() : void 0));
    return () => {
      alive = false;
    };
  }, [sub.carpark_id, token, onAuthError]);

  const act = async (action: 'approve' | 'reject') => {
    setBusy(true);
    setErr(null);
    try {
      await adminFetch(`/api/admin/edits`, token, {
        method: 'POST',
        body: JSON.stringify({ id: sub.id, action, review_note: reviewNote.trim() || undefined }),
      });
      onActed(sub.id, action === 'approve' ? 'approved' : 'rejected');
    } catch (e) {
      if ((e as AdminError).status === 401) onAuthError();
      else setErr((e as AdminError).message);
    } finally {
      setBusy(false);
    }
  };

  const lotsChanged = current && current.total_lots !== sub.proposed_total_lots;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{sub.carpark_name || sub.carpark_id}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {sub.carpark_id.toUpperCase()}
            {sub.carpark_source ? ` · ${sub.carpark_source}` : ''}
            {' · '}
            {new Date(sub.created_at).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[sub.status], textTransform: 'capitalize', flexShrink: 0 }}>
          {sub.status}
        </span>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 8 }}>
        From:{' '}
        {sub.submitter_name || sub.submitter_email ? (
          <>
            {sub.submitter_name || '—'}
            {sub.submitter_email ? (
              <> · <a href={`mailto:${sub.submitter_email}`} style={{ color: 'var(--accent)' }}>{sub.submitter_email}</a></>
            ) : null}
            {sub.submitter_user_id ? ' · signed in' : ' · anonymous'}
          </>
        ) : (
          'anonymous'
        )}
      </div>

      {sub.note && (
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>“{sub.note}”</p>
      )}

      {/* Diff */}
      <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-2)', borderRadius: 10, border: '0.5px solid var(--line)' }}>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          <span style={{ color: 'var(--text-3)' }}>Total lots: </span>
          <span style={{ color: 'var(--text-2)' }}>{current ? (current.total_lots ?? '—') : '…'}</span>
          <span style={{ color: 'var(--text-3)' }}> → </span>
          <span style={{ fontWeight: 700, color: lotsChanged ? 'var(--accent)' : 'var(--text-1)' }}>{sub.proposed_total_lots ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <RateList title="Current" rows={current?.rate_rows ?? []} muted />
          <RateList title="Proposed" rows={sub.proposed_rates ?? []} />
        </div>
      </div>

      {sub.status === 'pending' ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Review note (optional)"
            style={{ width: '100%', padding: '8px 11px', borderRadius: 10, border: '0.5px solid var(--line-strong)', background: 'var(--bg-2)', color: 'var(--text-1)', fontSize: 13, outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => act('approve')} disabled={busy} style={{ appearance: 'none', border: 0, padding: '9px 18px', borderRadius: 10, background: 'var(--accent)', color: 'var(--accent-on)', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              Approve &amp; apply
            </button>
            <button type="button" onClick={() => act('reject')} disabled={busy} style={{ appearance: 'none', border: '0.5px solid var(--line-strong)', padding: '9px 18px', borderRadius: 10, background: 'var(--bg-1)', color: 'var(--bad)', fontSize: 13.5, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
              Reject
            </button>
            {err && <span style={{ fontSize: 12.5, color: 'var(--bad)', alignSelf: 'center' }}>{err}</span>}
          </div>
        </div>
      ) : (
        (sub.reviewed_by || sub.review_note) && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
            {sub.status} {sub.reviewed_by ? `by ${sub.reviewed_by}` : ''}
            {sub.review_note ? ` — “${sub.review_note}”` : ''}
          </div>
        )
      )}
    </div>
  );
}

export function AdminEdits({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [subs, setSubs] = useState<EditSubmission[]>([]);
  const [filter, setFilter] = useState<string>('pending');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const qs = filter ? `?status=${filter}` : '';
    adminFetch<{ submissions: EditSubmission[] }>(`/api/admin/edits${qs}`, token)
      .then((d2) => {
        setSubs(d2.submissions);
        setErr(null);
      })
      .catch((e: AdminError) => (e.status === 401 ? onAuthError() : setErr(e.message)))
      .finally(() => setLoading(false));
  }, [token, filter, onAuthError]);

  useEffect(load, [load]);

  const onActed = (id: string) => {
    // Drop the acted row from the current (usually "pending") view.
    setSubs((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>
          Edit requests <span style={{ color: 'var(--text-3)', fontWeight: 500, fontSize: 15 }}>({subs.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                appearance: 'none',
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: filter === s ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
                background: filter === s ? 'var(--accent-tint-strong)' : 'var(--bg-1)',
                color: filter === s ? 'var(--accent)' : 'var(--text-2)',
                textTransform: 'capitalize',
              }}
            >
              {s || 'all'}
            </button>
          ))}
        </div>
      </div>

      {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
      {loading && subs.length === 0 ? (
        <div style={{ color: 'var(--text-3)', padding: 20 }}>Loading…</div>
      ) : subs.length === 0 ? (
        <div style={{ color: 'var(--text-3)', padding: 20 }}>No {filter || ''} edit requests.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {subs.map((s) => (
            <SubmissionCard key={s.id} sub={s} token={token} onAuthError={onAuthError} onActed={onActed} />
          ))}
        </div>
      )}
    </div>
  );
}
