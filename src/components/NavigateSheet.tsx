import type { CSSProperties, ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { IconChevronRight, IconGoogleG, IconMap, IconNavigate } from './icons';
import {
  MAPS_PROVIDER_LABELS,
  availableProviders,
  type MapsProvider,
} from '../lib/maps';
import { isApplePlatform } from '../lib/platform';

/** Per-provider icon tile (brand-tinted, monochrome to match the icon set). */
const PROVIDER_VISUAL: Record<MapsProvider, { icon: ReactNode; tile: CSSProperties }> = {
  google: {
    icon: <IconGoogleG size={20} />,
    tile: { background: 'var(--bg-3)', border: '0.5px solid var(--line-strong)' },
  },
  waze: {
    icon: <IconNavigate size={19} stroke={2} />,
    tile: { background: 'rgba(51,178,224,0.14)', color: '#1aa0d8' },
  },
  apple: {
    icon: <IconMap size={19} stroke={2} />,
    tile: { background: 'var(--bg-3)', color: 'var(--text-2)', border: '0.5px solid var(--line-strong)' },
  },
};

export function NavigateSheet({
  open,
  onClose,
  carparkName,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  carparkName: string;
  /** Caller opens the deep link, remembers the choice, and logs analytics. */
  onPick: (provider: MapsProvider) => void;
}) {
  const providers = availableProviders(isApplePlatform());

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '8px 20px 6px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.3,
          }}
        >
          Navigate there
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--text-3)',
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Directions to {carparkName} entrance
        </div>
      </div>

      <div style={{ padding: '6px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {providers.map((p) => {
          const v = PROVIDER_VISUAL[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPick(p);
                onClose();
              }}
              style={{
                appearance: 'none',
                border: '0.5px solid var(--line-strong)',
                background: 'var(--bg-1)',
                borderRadius: 12,
                padding: '11px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                minHeight: 56,
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  ...v.tile,
                }}
              >
                {v.icon}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                  }}
                >
                  {MAPS_PROVIDER_LABELS[p]}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                  Opens the app
                </span>
              </span>
              <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                <IconChevronRight size={16} stroke={2} />
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
