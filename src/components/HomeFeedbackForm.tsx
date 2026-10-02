import { useState, type CSSProperties } from 'react';
import type { User } from '../lib/types';
import { submitAppFeedback, type AppFeedbackCategory } from '../lib/api/feedback';
import { trackEvent } from '../lib/api/events';
import { IconCheck } from './icons';

const CATEGORIES: [AppFeedbackCategory, string][] = [
  ['idea', 'Idea'],
  ['problem', 'Problem'],
  ['praise', 'Praise'],
  ['other', 'Other'],
];

const MAX = 2000;

/**
 * Home-page feedback card: a type, a message and an optional reply-to email.
 * Stored in `app_feedback` (migration 014); the admin panel's Feedback tab
 * shows new submissions with an unread count. The email and send button stay
 * hidden until there's a message, so the card is light on an empty home page.
 */
export function HomeFeedbackForm({ user }: { user: User | null }) {
  const [category, setCategory] = useState<AppFeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'rate_limited'>('idle');

  const hasMessage = message.trim().length > 0;
  const sending = status === 'sending';

  const send = async () => {
    if (!hasMessage || sending) return;
    setStatus('sending');
    const result = await submitAppFeedback({
      category,
      message: message.trim(),
      email: user?.email ?? (email.trim() || null),
      userId: user?.id ?? null,
    });
    if (result === 'ok') {
      trackEvent('feedback_submitted', { category });
      setStatus('sent');
      setMessage('');
      setEmail('');
    } else {
      setStatus(result);
    }
  };

  if (status === 'sent') {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...badge, background: 'var(--ok-bg)', color: 'var(--ok)' }}>
            <IconCheck size={16} stroke={2.5} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={title}>Thanks, got it</div>
            <div style={sub}>Every message is read.</div>
          </div>
          <button type="button" onClick={() => setStatus('idle')} style={linkBtn}>
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      style={card}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div style={title}>Help improve wheretopark.sg</div>
      <div style={{ ...sub, marginBottom: 12 }}>Missing a carpark, a wrong price, or an idea? Tell us.</div>

      <div role="radiogroup" aria-label="Feedback type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
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
                padding: '5px 11px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                border: active ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)',
                background: active ? 'var(--accent-tint-strong)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-2)',
                minHeight: 28,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value.slice(0, MAX));
          if (status !== 'idle' && status !== 'sending') setStatus('idle');
        }}
        rows={3}
        placeholder="Your feedback"
        aria-label="Your feedback"
        style={{ ...field, resize: 'vertical', minHeight: 76, lineHeight: 1.45 }}
      />

      {hasMessage && (
        <>
          {!user && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email, if you'd like a reply (optional)"
              aria-label="Email for a reply (optional)"
              autoComplete="email"
              style={{ ...field, marginTop: 8 }}
            />
          )}
          <button
            type="submit"
            data-track="feedback_submit"
            disabled={sending}
            style={{
              appearance: 'none',
              border: 0,
              width: '100%',
              marginTop: 10,
              padding: '11px 14px',
              minHeight: 44,
              borderRadius: 10,
              background: 'var(--accent)',
              color: 'var(--accent-on)',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: sending ? 'wait' : 'pointer',
              opacity: sending ? 0.7 : 1,
              fontFamily: 'var(--font-body)',
            }}
          >
            {sending ? 'Sending…' : 'Send feedback'}
          </button>
          {user && (
            <div style={{ ...sub, marginTop: 8 }}>We'll reply to {user.email} if needed.</div>
          )}
        </>
      )}

      {(status === 'error' || status === 'rate_limited') && (
        <div role="alert" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--bad)' }}>
          {status === 'rate_limited'
            ? "You've sent a few already. Please try again in an hour."
            : "Couldn't send. Check your connection and try again."}
        </div>
      )}
    </form>
  );
}

const card: CSSProperties = {
  marginTop: 22,
  background: 'var(--bg-1)',
  border: '0.5px solid var(--line)',
  borderRadius: 14,
  padding: '16px 16px',
};
const title: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-1)',
  letterSpacing: -0.2,
};
const sub: CSSProperties = { fontSize: 12.5, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.45 };
const badge: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 9,
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const field: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'var(--bg-2)',
  border: '0.5px solid var(--line-strong)',
  borderRadius: 10,
  color: 'var(--text-1)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  outline: 'none',
};
const linkBtn: CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
};
