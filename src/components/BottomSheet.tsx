import { useEffect, type ReactNode } from 'react';

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 80,
          background: 'rgba(14,16,20,0.32)',
          animation: 'psg-fade-in 180ms ease both',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 81,
          background: 'var(--bg-0)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          boxShadow: '0 -14px 40px rgba(14,16,20,0.20)',
          animation: 'psg-sheet-up 260ms cubic-bezier(0.22,1,0.36,1) both',
          paddingBottom: 30,
          maxHeight: '90%',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 0 4px',
          }}
        >
          <span
            style={{
              width: 38,
              height: 4,
              borderRadius: 999,
              background: 'var(--line-strong)',
            }}
          />
        </div>
        {children}
      </div>
      <style>{`
        @keyframes psg-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes psg-sheet-up {
          from { transform: translate3d(0, 100%, 0); }
          to   { transform: translate3d(0, 0, 0); }
        }
      `}</style>
    </>
  );
}
