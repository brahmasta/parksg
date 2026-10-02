import { useState } from 'react';
import { FeedbackDialog } from './FeedbackDialog';
import type { User } from '../lib/types';

/**
 * Global app footer — sits at the bottom of the home screen's scrollable
 * body. A single line of micro-copy whose link opens the feedback form
 * (FeedbackDialog: a bottom sheet on phone, a centred modal on desktop).
 *
 * Kept small (10pt) so it never competes with the content above it.
 */
export function AppFooter({
  user = null,
  variant = 'sheet',
}: {
  user?: User | null;
  variant?: 'sheet' | 'modal';
}) {
  const [open, setOpen] = useState(false);
  return (
    <footer
      style={{
        marginTop: 18,
        padding: '0 4px',
        fontSize: 10,
        color: 'var(--text-3)',
        fontFamily: 'var(--font-body)',
        lineHeight: 1.6,
        textAlign: 'center',
      }}
    >
      Missing a carpark, or have an idea?{' '}
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-track="feedback_link"
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          padding: 0,
          font: 'inherit',
          color: 'var(--ok)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        Send feedback
      </button>
      <FeedbackDialog
        key={open ? 'feedback-open' : 'feedback-closed'}
        open={open}
        onClose={() => setOpen(false)}
        variant={variant}
        user={user}
      />
    </footer>
  );
}
