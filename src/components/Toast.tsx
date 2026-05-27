import { useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastContent = {
  icon: ReactNode;
  title: string;
  sub?: string;
};

export type ToastHandle = {
  pop: (t: ToastContent) => void;
};

export function useToast() {
  const [toast, setToast] = useState<ToastContent | null>(null);
  const timer = useRef<number | null>(null);

  const pop = (t: ToastContent) => {
    setToast(t);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2300);
  };

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return { toast, pop } as const;
}

export function Toast({
  toast,
  bottomOffset = 28,
}: {
  toast: ToastContent | null;
  bottomOffset?: number;
}) {
  if (!toast) return null;
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: bottomOffset,
        zIndex: 90,
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line-strong)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow:
          '0 14px 36px rgba(14,16,20,0.18), 0 2px 6px rgba(14,16,20,0.08)',
        animation: 'psg-slide-up 220ms cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'var(--accent-tint-strong)',
          color: 'var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {toast.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>
          {toast.title}
        </div>
        {toast.sub && (
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-3)',
              marginTop: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.sub}
          </div>
        )}
      </div>
    </div>
  );
}
