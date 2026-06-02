import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconAppleMaps, IconChevronRight, IconClose, IconGoogleMaps, IconWaze } from './icons';
import { MAPS_PROVIDER_LABELS, availableProviders, type MapsProvider } from '../lib/maps';
import { isApplePlatform } from '../lib/platform';

const PROVIDER_ICON: Record<MapsProvider, ReactNode> = {
  google: <IconGoogleMaps size={38} />,
  waze: <IconWaze size={38} />,
  apple: <IconAppleMaps size={38} />,
};

/** Desktop variant of NavigateSheet — a centered modal over a dimmed backdrop. */
export function NavigateModal({
  open,
  onClose,
  carparkName,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  carparkName: string;
  onPick: (provider: MapsProvider) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  const providers = availableProviders(isApplePlatform());

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigate there"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
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
          width: 'min(420px, 100%)',
          background: 'var(--bg-1)',
          border: '0.5px solid var(--line-strong)',
          borderRadius: 20,
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.3 }}>Navigate there</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Directions to {carparkName} entrance
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ appearance: 'none', width: 32, height: 32, borderRadius: 999, border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <IconClose size={15} stroke={2} />
          </button>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onPick(p);
                onClose();
              }}
              style={{ appearance: 'none', border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', textAlign: 'left', minHeight: 56 }}
            >
              <span style={{ display: 'inline-flex', flexShrink: 0 }}>{PROVIDER_ICON[p]}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{MAPS_PROVIDER_LABELS[p]}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>Opens in a new tab</span>
              </span>
              <span style={{ color: 'var(--text-3)', flexShrink: 0 }}><IconChevronRight size={16} stroke={2} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
