import { useState } from 'react';
import { AddCarparkDialog } from './AddCarparkDialog';
import type { User } from '../lib/types';

/** A text link that opens the "Add a carpark" dialog. Self-contained (owns the
 * dialog open state) so it can be dropped into the footer, empty-results, etc. */
export function AddCarparkLink({
  user = null,
  variant = 'sheet',
  label = 'Add a carpark',
  style,
}: {
  user?: User | null;
  variant?: 'sheet' | 'modal';
  label?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          color: 'var(--accent)',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          ...style,
        }}
      >
        {label}
      </button>
      <AddCarparkDialog
        key={open ? 'add-open' : 'add-closed'}
        open={open}
        onClose={() => setOpen(false)}
        variant={variant}
        user={user}
      />
    </>
  );
}
