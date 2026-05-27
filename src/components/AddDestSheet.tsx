import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { DestinationIcon } from './DestinationIcon';
import { IconPin } from './icons';
import { DESTINATION_ICONS, type DestIcon } from '../lib/types';

export type AddDestPrefill = {
  name?: string;
  address?: string;
  icon?: DestIcon;
  /** Coords from the original search. Persisted on save so chip-tap can
   * re-open the exact same location with the user's friendly name as the
   * header label — no second geocode round-trip. */
  lat?: number;
  lng?: number;
};

export type AddDestPayload = {
  name: string;
  address: string;
  icon: DestIcon;
  lat?: number;
  lng?: number;
};

export function AddDestSheet({
  open,
  onClose,
  onSave,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (d: AddDestPayload) => void;
  prefill?: AddDestPrefill | null;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [icon, setIcon] = useState<DestIcon>('pin');

  useEffect(() => {
    if (open) {
      setName(prefill?.name ?? '');
      setAddress(prefill?.address ?? '');
      setIcon(prefill?.icon ?? 'pin');
    }
  }, [open, prefill]);

  const canSave = name.trim().length > 0 && address.trim().length > 0;
  const hasPrefill = !!prefill;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '4px 16px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0 14px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              color: 'var(--text-2)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              padding: 0,
            }}
          >
            Cancel
          </button>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.2,
            }}
          >
            {hasPrefill ? 'Save this destination' : 'Add destination'}
          </div>
          <button
            type="button"
            onClick={() =>
              canSave &&
              onSave({
                name: name.trim(),
                address: address.trim(),
                icon,
                // Forward prefill coords (hot-path save) so the saved record
                // round-trips back to the original location on chip tap.
                lat: prefill?.lat,
                lng: prefill?.lng,
              })
            }
            disabled={!canSave}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              color: canSave ? 'var(--accent)' : 'var(--text-3)',
              cursor: canSave ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
              padding: 0,
            }}
          >
            Save
          </button>
        </div>

        {hasPrefill && prefill?.address && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              marginBottom: 14,
              background: 'var(--accent-tint)',
              border: '1px solid var(--accent)',
              borderRadius: 10,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'var(--accent)',
                color: 'var(--accent-on)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconPin size={13} stroke={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--text-1)',
                  letterSpacing: -0.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {prefill.address}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: 'var(--text-2)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 0.3,
                  marginTop: 1,
                }}
              >
                FROM YOUR SEARCH
              </div>
            </div>
          </div>
        )}

        <MonoLabel>{hasPrefill ? 'Save as' : 'Name'}</MonoLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Office"
          autoFocus
          style={inputStyle}
        />

        {!hasPrefill && (
          <>
            <MonoLabel style={{ marginTop: 16 }}>Address or postcode</MonoLabel>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 048583"
              style={inputStyle}
            />
          </>
        )}

        <MonoLabel style={{ marginTop: 16 }}>Icon</MonoLabel>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 16, flexWrap: 'wrap' }}>
          {DESTINATION_ICONS.map((n) => {
            const active = icon === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setIcon(n)}
                aria-label={n}
                aria-pressed={active}
                style={{
                  appearance: 'none',
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: active ? 'var(--accent-tint-strong)' : 'var(--bg-1)',
                  border: active
                    ? '1px solid var(--accent)'
                    : '0.5px solid var(--line-strong)',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <DestinationIcon name={n} size={17} />
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--bg-2)',
  border: '0.5px solid var(--line-strong)',
  color: 'var(--text-1)',
  fontSize: 15,
  fontFamily: 'var(--font-body)',
  outline: 'none',
  boxSizing: 'border-box',
  marginTop: 8,
};

function MonoLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        color: 'var(--text-3)',
        letterSpacing: 1,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
