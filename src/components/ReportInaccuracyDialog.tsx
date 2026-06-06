import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from './BottomSheet';
import { IconCheck, IconClose, IconInfo, IconWarning } from './icons';
import { submitInaccuracyReport } from '../lib/api/feedback';

/** The reportable problem categories. Live availability is deliberately absent —
 *  it's LTA-owned and not something we can fix (see the note in the form). */
const CATEGORIES = [
  'Incorrect parking rates / pricing',
  'Incorrect capacity or number of lots',
  'Wrong location / map pin',
  'Wrong name or address',
  'Carpark closed or no longer exists',
  'Other',
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** 'sheet' = mobile bottom sheet, 'modal' = desktop centered dialog. */
  variant?: 'sheet' | 'modal';
  carpark: { id: string; name: string; source?: string };
};

export function ReportInaccuracyDialog({
  open,
  onClose,
  variant = 'sheet',
  carpark,
}: Props) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  );

  // No reset effect: the parent remounts this via `key` on each open, so the
  // initial useState values above are the clean state. (Avoids a setState-in-
  // effect.)

  // Esc closes (the modal backdrop also handles click-out).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const missingCategory = touched && !category.trim();
  const missingDescription = touched && !description.trim();

  const clear = () => {
    setCategory('');
    setDescription('');
    setEmail('');
    setTouched(false);
    setStatus('idle');
  };

  const submit = async () => {
    setTouched(true);
    if (!category.trim() || !description.trim()) return;
    setStatus('submitting');
    const ok = await submitInaccuracyReport({
      carparkName: carpark.name,
      category,
      description,
      carparkId: carpark.id,
      carparkSource: carpark.source ?? null,
      email: email.trim() || null,
    });
    setStatus(ok ? 'success' : 'error');
    if (ok) window.setTimeout(onClose, 1500);
  };

  const body =
    status === 'success' ? (
      <div
        style={{
          padding: '28px 22px 34px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: 'var(--accent-tint, rgba(46,227,194,0.16))',
            color: 'var(--accent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconCheck size={26} stroke={2.5} />
        </span>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-1)',
          }}
        >
          Report submitted
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 280, lineHeight: 1.45 }}>
          Thanks for helping improve wheretopark.sg — we&rsquo;ll review it.
        </div>
      </div>
    ) : (
      <div style={{ padding: '4px 20px 22px' }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ color: 'var(--bad, #C0392B)', display: 'inline-flex' }}>
              <IconWarning size={19} stroke={2} />
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-1)',
                letterSpacing: -0.3,
              }}
            >
              Report data inaccuracy
            </span>
          </div>
          {variant === 'modal' && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={iconBtnStyle}
            >
              <IconClose size={15} stroke={2} />
            </button>
          )}
        </div>

        {/* Read-only carpark identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <ReadonlyRow label="Carpark ID" value={carpark.id.toUpperCase()} />
          <ReadonlyRow label="Carpark name" value={carpark.name} />
        </div>

        {/* Category */}
        <Label htmlFor="ri-category">Category of inaccuracy</Label>
        <select
          id="ri-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            ...fieldStyle,
            appearance: 'none',
            cursor: 'pointer',
            color: category ? 'var(--text-1)' : 'var(--text-3)',
            borderColor: missingCategory ? 'var(--bad, #C0392B)' : 'var(--line-strong)',
          }}
        >
          <option value="" disabled>
            Please choose a category
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} style={{ color: 'var(--text-1)' }}>
              {c}
            </option>
          ))}
        </select>
        {missingCategory && <ErrorText>Please choose a category.</ErrorText>}

        {/* LTA note */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            margin: '12px 0 4px',
            padding: '10px 12px',
            background: 'var(--bg-2)',
            borderRadius: 10,
            border: '0.5px solid var(--line)',
          }}
        >
          <span style={{ color: 'var(--warn, #A66B00)', display: 'inline-flex', flexShrink: 0, marginTop: 1 }}>
            <IconInfo size={15} stroke={2} />
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Live availability (lots free) is provided by the LTA and can&rsquo;t be
            corrected by us. Rates, capacity, location and names can.
          </span>
        </div>

        {/* Description */}
        <Label htmlFor="ri-desc">Describe the inaccuracy</Label>
        <textarea
          id="ri-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is wrong, and what should it be?"
          rows={4}
          style={{
            ...fieldStyle,
            resize: 'vertical',
            minHeight: 92,
            fontFamily: 'inherit',
            borderColor: missingDescription ? 'var(--bad, #C0392B)' : 'var(--line-strong)',
          }}
        />
        {missingDescription && <ErrorText>Please describe the inaccuracy.</ErrorText>}

        {/* Email (optional) */}
        <Label htmlFor="ri-email">Email for follow-up (optional)</Label>
        <input
          id="ri-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={fieldStyle}
        />

        {status === 'error' && (
          <ErrorText>Couldn&rsquo;t submit — please check your connection and try again.</ErrorText>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={clear}
            disabled={status === 'submitting'}
            style={{
              appearance: 'none',
              flex: '0 0 auto',
              padding: '12px 18px',
              borderRadius: 12,
              border: '0.5px solid var(--line-strong)',
              background: 'var(--bg-1)',
              color: 'var(--text-2)',
              fontSize: 14,
              fontWeight: 600,
              cursor: status === 'submitting' ? 'default' : 'pointer',
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={status === 'submitting'}
            style={{
              appearance: 'none',
              flex: 1,
              padding: '12px 18px',
              borderRadius: 12,
              border: 0,
              background: 'var(--accent)',
              color: 'var(--accent-on)',
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              cursor: status === 'submitting' ? 'wait' : 'pointer',
              opacity: status === 'submitting' ? 0.7 : 1,
            }}
          >
            {status === 'submitting' ? 'Submitting…' : 'Submit report'}
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
        aria-label="Report data inaccuracy"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: 'rgba(14,16,20,0.42)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        <div
          className="psg-screen"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(440px, 100%)',
            maxHeight: 'calc(100dvh - 40px)',
            overflowY: 'auto',
            background: 'var(--bg-0)',
            border: '0.5px solid var(--line-strong)',
            borderRadius: 20,
            boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
          }}
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
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-2)',
        margin: '12px 0 6px',
      }}
    >
      {children}
    </label>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--bad, #C0392B)', marginTop: 6 }}>{children}</div>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 10,
        background: 'var(--bg-2)',
        border: '0.5px solid var(--line)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, minWidth: 86 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--text-1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}
