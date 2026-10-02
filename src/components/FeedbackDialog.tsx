import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from './BottomSheet';
import { IconCheck, IconClose } from './icons';
import { submitAppFeedback, type AppFeedbackCategory } from '../lib/api/feedback';
import { trackEvent } from '../lib/api/events';
import type { User } from '../lib/types';

const CATEGORIES: [AppFeedbackCategory, string][] = [
  ['idea', 'Idea'],
  ['problem', 'Problem'],
  ['praise', 'Praise'],
  ['other', 'Other'],
];

const MAX = 2000;

type Props = {
  open: boolean;
  onClose: () => void;
  /** 'sheet' = phone bottom sheet, 'modal' = desktop centred dialog. */
  variant?: 'sheet' | 'modal';
  user?: User | null;
};

/**
 * General feedback: a type, a message and an optional reply-to email. Stored
 * in `app_feedback` (migration 014); the admin Feedback tab shows new ones
 * with an unread count. Same sheet/modal shell as AddCarparkDialog; the parent
 * remounts it via `key` on each open, so the initial state is the clean state.
 */
export function FeedbackDialog({ open, onClose, variant = 'sheet', user = null }: Props) {
  const [category, setCategory] = useState<AppFeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error' | 'rate_limited'>('idle');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const missingMessage = touched && !message.trim();
  const submitting = status === 'submitting';

  const submit = async () => {
    setTouched(true);
    if (!message.trim() || submitting) return;
    setStatus('submitting');
    const result = await submitAppFeedback({
      category,
      message: message.trim(),
      email: user?.email ?? (email.trim() || null),
      userId: user?.id ?? null,
    });
    if (result === 'ok') {
      trackEvent('feedback_submitted', { category });
      setStatus('success');
      window.setTimeout(onClose, 1600);
    } else {
      setStatus(result === 'rate_limited' ? 'rate_limited' : 'error');
    }
  };

  const body =
    status === 'success' ? (
      <div style={{ padding: '28px 22px 34px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--accent-tint, rgba(46,227,194,0.16))', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={26} stroke={2.5} />
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>Thanks, got it</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 300, lineHeight: 1.45 }}>
          Every message is read{user || email.trim() ? ', and we’ll reply if needed' : ''}.
        </div>
      </div>
    ) : (
      <div className="psg-rich" style={{ padding: '4px 20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.3 }}>
            Send feedback
          </span>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtnStyle}>
            <IconClose size={16} stroke={2} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.45, marginBottom: 14 }}>
          Missing a carpark, a wrong price, or an idea? Tell us.
        </div>

        <div role="radiogroup" aria-label="Feedback type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(([key, label]) => {
            const active = category === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                data-track="feedback_category"
                onClick={() => setCategory(key)}
                style={{
                  appearance: 'none',
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  border: active ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
                  background: active ? 'var(--accent-tint-strong)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  minHeight: 32,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <Label htmlFor="fb-message">Your feedback</Label>
        <textarea
          id="fb-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
          rows={5}
          autoFocus={variant === 'modal'}
          style={{
            ...fieldStyle,
            resize: 'vertical',
            lineHeight: 1.45,
            fontFamily: 'var(--font-body)',
            borderColor: missingMessage ? 'var(--bad, #C0392B)' : 'var(--line-strong)',
          }}
        />
        {missingMessage && <ErrorText>Please write a message.</ErrorText>}

        {user ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            We&rsquo;ll reply to {user.email} if needed.
          </div>
        ) : (
          <>
            <Label htmlFor="fb-email">Email (optional, if you&rsquo;d like a reply)</Label>
            <input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={fieldStyle}
            />
          </>
        )}

        {status === 'error' && <ErrorText>Couldn&rsquo;t send. Check your connection and try again.</ErrorText>}
        {status === 'rate_limited' && <ErrorText>You&rsquo;ve sent a few already. Please try again in an hour.</ErrorText>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ appearance: 'none', flex: '0 0 auto', padding: '12px 18px', borderRadius: 12, border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: submitting ? 'default' : 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={submitting} data-track="feedback_submit" style={{ appearance: 'none', flex: 1, padding: '12px 18px', borderRadius: 12, border: 0, background: 'var(--accent)', color: 'var(--accent-on)', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </div>
    );

  if (variant === 'modal') {
    if (!open || typeof document === 'undefined') return null;
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label="Send feedback" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(14,16,20,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
        <div className="psg-screen" onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', background: 'var(--bg-0)', border: '0.5px solid var(--line-strong)', borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,0.35)', paddingTop: 16 }}>
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

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12,
  border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)',
  color: 'var(--text-1)', fontSize: 14, outline: 'none',
};
const iconBtnStyle: React.CSSProperties = {
  appearance: 'none', width: 32, height: 32, borderRadius: 999,
  border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--text-2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
};

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '14px 0 6px' }}>
      {children}
    </label>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <div role="alert" style={{ marginTop: 6, fontSize: 12, color: 'var(--bad, #C0392B)' }}>{children}</div>;
}
