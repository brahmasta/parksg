import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from './BottomSheet';
import { IconCheck, IconClose, IconInfo } from './icons';
import { RateGridEditor } from './RateGridEditor';
import { blankEditableRate, type EditableRate } from './rateGrid';
import { submitCarparkEdit } from '../lib/api/carparkEdit';
import type { User } from '../lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  /** 'sheet' = mobile bottom sheet, 'modal' = desktop centered dialog. */
  variant?: 'sheet' | 'modal';
  carpark: { id: string; name: string; source?: string };
  /** Current capacity (null = unknown), pre-filled into the lots field. */
  currentTotalLots: number | null;
  /** Current rate schedule, flattened to editable rows and pre-filled. */
  initialRates: EditableRate[];
  /** Signed-in user, if any — pre-fills/locks the contact identity. */
  user?: User | null;
};

export function SuggestEditDialog({
  open,
  onClose,
  variant = 'sheet',
  carpark,
  currentTotalLots,
  initialRates,
  user = null,
}: Props) {
  // Parent remounts via `key` on each open, so initial useState values are the
  // clean state (avoids a setState-in-effect reset).
  const [totalLots, setTotalLots] = useState(
    currentTotalLots == null ? '' : String(currentTotalLots),
  );
  const [rates, setRates] = useState<EditableRate[]>(() => initialRates.map((r) => ({ ...r })));
  const [note, setNote] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Anonymous submitters must leave an email so we can follow up / de-dupe.
  const needEmail = !user && touched && !email.trim();

  const submit = async () => {
    setTouched(true);
    if (!user && !email.trim()) return;
    setStatus('submitting');
    const ok = await submitCarparkEdit({
      carparkId: carpark.id,
      carparkName: carpark.name,
      carparkSource: carpark.source ?? null,
      totalLots: totalLots.trim() === '' ? null : Math.round(Number(totalLots)) || null,
      rates,
      note: note.trim() || null,
      userId: user?.id ?? null,
      email: (user?.email ?? email).trim() || null,
      name: (user?.name ?? name).trim() || null,
    });
    setStatus(ok ? 'success' : 'error');
    if (ok) window.setTimeout(onClose, 1600);
  };

  const body =
    status === 'success' ? (
      <div style={{ padding: '28px 22px 34px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--accent-tint, rgba(46,227,194,0.16))', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={26} stroke={2.5} />
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>
          Sent for review
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 300, lineHeight: 1.45 }}>
          Thanks for helping improve wheretopark.sg — an admin will review your suggested changes before they go live.
        </div>
      </div>
    ) : (
      <div style={{ padding: '4px 20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.3 }}>
            Suggest an edit
          </span>
          {variant === 'modal' && (
            <button type="button" aria-label="Close" onClick={onClose} style={iconBtnStyle}>
              <IconClose size={15} stroke={2} />
            </button>
          )}
        </div>

        <ReadonlyRow label="Carpark" value={carpark.name} />

        <div style={{ display: 'flex', gap: 8, margin: '14px 0 6px', padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 10, border: '0.5px solid var(--line)' }}>
          <span style={{ color: 'var(--warn, #A66B00)', display: 'inline-flex', flexShrink: 0, marginTop: 1 }}>
            <IconInfo size={15} stroke={2} />
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Edit the total lots and/or rate schedule below. Changes are reviewed by an admin before they appear. Live availability (lots free now) is LTA-owned and can&rsquo;t be edited here.
          </span>
        </div>

        <Label htmlFor="se-lots">Total lots</Label>
        <input
          id="se-lots"
          inputMode="numeric"
          value={totalLots}
          onChange={(e) => setTotalLots(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="e.g. 480 (leave blank if unknown)"
          style={fieldStyle}
        />

        <div style={{ margin: '16px 0 4px' }}>
          <RateGridEditor
            rates={rates}
            setRates={setRates}
            makeBlank={blankEditableRate}
            note="Amounts in dollars. Times in 24h HH:MM; blank = all day. This replaces the whole schedule if approved."
          />
        </div>

        <Label htmlFor="se-note">Note for the reviewer (optional)</Label>
        <textarea
          id="se-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What changed and where you saw it (e.g. a photo of the rate board, operator website)…"
          rows={3}
          style={{ ...fieldStyle, resize: 'vertical', minHeight: 76, fontFamily: 'inherit' }}
        />

        {/* Contact */}
        {user ? (
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-3)' }}>
            Submitting as <strong style={{ color: 'var(--text-2)' }}>{user.name || user.email}</strong>
            {user.name ? ` (${user.email})` : ''}
          </div>
        ) : (
          <>
            <Label htmlFor="se-name">Your name (optional)</Label>
            <input id="se-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={fieldStyle} />
            <Label htmlFor="se-email">Your email</Label>
            <input
              id="se-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ ...fieldStyle, borderColor: needEmail ? 'var(--bad, #C0392B)' : 'var(--line-strong)' }}
            />
            {needEmail && <ErrorText>Please leave an email so we can follow up.</ErrorText>}
          </>
        )}

        {status === 'error' && (
          <ErrorText>Couldn&rsquo;t submit — please check your connection and try again.</ErrorText>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'submitting'}
            style={{ appearance: 'none', flex: '0 0 auto', padding: '12px 18px', borderRadius: 12, border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: status === 'submitting' ? 'default' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={status === 'submitting'}
            style={{ appearance: 'none', flex: 1, padding: '12px 18px', borderRadius: 12, border: 0, background: 'var(--accent)', color: 'var(--accent-on)', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, cursor: status === 'submitting' ? 'wait' : 'pointer', opacity: status === 'submitting' ? 0.7 : 1 }}
          >
            {status === 'submitting' ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </div>
    );

  if (variant === 'modal') {
    if (!open || typeof document === 'undefined') return null;
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Suggest an edit"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(14,16,20,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      >
        <div
          className="psg-screen"
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(520px, 100%)', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', background: 'var(--bg-0)', border: '0.5px solid var(--line-strong)', borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}
        >
          {body}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      {body}
    </BottomSheet>
  );
}

// ── Small styled helpers ────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 12,
  border: '0.5px solid var(--line-strong)',
  background: 'var(--bg-1)',
  color: 'var(--text-1)',
  fontSize: 14,
  outline: 'none',
};

const iconBtnStyle: React.CSSProperties = {
  appearance: 'none',
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '0.5px solid var(--line-strong)',
  background: 'var(--bg-1)',
  color: 'var(--text-2)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '12px 0 6px' }}>
      {children}
    </label>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--bad, #C0392B)', marginTop: 6 }}>{children}</div>;
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--bg-2)', border: '0.5px solid var(--line)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, minWidth: 64 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
