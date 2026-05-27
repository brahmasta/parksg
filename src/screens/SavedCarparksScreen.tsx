import { useMemo } from 'react';
import type { SavedCarparkSnapshot } from '../lib/saves';
import { BookmarkToggle } from '../components/BookmarkToggle';
import { OperatorBadge } from '../components/atoms';
import { IconBookmark, IconChevronLeft } from '../components/icons';

export function SavedCarparksScreen({
  snapshots,
  onUnsave,
  onBack,
  onSelect,
  onGoHome,
}: {
  snapshots: SavedCarparkSnapshot[];
  onUnsave: (id: string) => void;
  onBack: () => void;
  onSelect: (snapshot: SavedCarparkSnapshot) => void;
  onGoHome: () => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, SavedCarparkSnapshot[]>();
    for (const s of snapshots) {
      const list = m.get(s.area) ?? [];
      list.push(s);
      m.set(s.area, list);
    }
    return [...m.entries()];
  }, [snapshots]);

  const empty = snapshots.length === 0;

  return (
    <div
      className="psg-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TopBar
        onBack={onBack}
        title="Saved carparks"
        eyebrow={empty ? null : `${snapshots.length} synced`}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        {empty ? (
          <EmptyState
            icon={<IconBookmark size={28} stroke={1.5} />}
            title="No saved carparks yet"
            body="Tap the bookmark on any carpark in the results list and it'll show up here, synced to your account."
            primary={{ label: 'Find a carpark', onClick: onGoHome }}
          />
        ) : (
          <div
            className="psg-stagger"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              paddingTop: 4,
            }}
          >
            {grouped.map(([area, list]) => (
              <div key={area}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    padding: '0 4px',
                  }}
                >
                  <MonoLabel>{area}</MonoLabel>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: 0.3,
                    }}
                  >
                    {list.length}
                  </span>
                </div>
                <div
                  style={{
                    background: 'var(--bg-1)',
                    border: '0.5px solid var(--line)',
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  {list.map((s, i) => (
                    <Row
                      key={s.id}
                      s={s}
                      onSelect={() => onSelect(s)}
                      onUnsave={() => onUnsave(s.id)}
                      last={i === list.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 4,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: 0.3,
                lineHeight: 1.5,
              }}
            >
              Last cost is your most recent estimate · live availability updates
              on open
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  s,
  onSelect,
  onUnsave,
  last,
}: {
  s: SavedCarparkSnapshot;
  onSelect: () => void;
  onUnsave: () => void;
  last: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 8px 14px 14px',
        borderBottom: last ? 'none' : '0.5px solid var(--line)',
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          textAlign: 'left',
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
          padding: 0,
          display: 'block',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}
        >
          <OperatorBadge operator={s.operator} />
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 0.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {s.area}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.2,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {s.name}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            fontSize: 11.5,
            color: 'var(--text-3)',
          }}
        >
          <span
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0.2 }}
          >
            EST · 2 hr
          </span>
          <span>·</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.1,
            }}
          >
            ${s.lastCost.toFixed(2)}
          </span>
        </div>
      </button>
      <BookmarkToggle saved onToggle={onUnsave} />
    </div>
  );
}

function TopBar({
  onBack,
  title,
  eyebrow,
  trailing,
}: {
  onBack: () => void;
  title: string;
  eyebrow?: string | null;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '52px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        style={{
          appearance: 'none',
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'var(--bg-1)',
          border: '0.5px solid var(--line-strong)',
          color: 'var(--text-1)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconChevronLeft size={18} stroke={2} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <MonoLabel>{eyebrow}</MonoLabel>}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.4,
            lineHeight: 1.15,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
      </div>
      {trailing}
    </div>
  );
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        color: 'var(--text-3)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  primary?: { label: string; onClick: () => void; icon?: React.ReactNode };
}) {
  return (
    <div
      style={{
        padding: '36px 16px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: 'var(--accent-tint)',
          border: '0.5px solid var(--accent)',
          color: 'var(--accent)',
          marginBottom: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: -0.3,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '8px 0 22px',
          fontSize: 13.5,
          color: 'var(--text-2)',
          lineHeight: 1.55,
          maxWidth: 280,
          textWrap: 'pretty',
        }}
      >
        {body}
      </p>
      {primary && (
        <button
          type="button"
          onClick={primary.onClick}
          style={{
            appearance: 'none',
            border: 0,
            padding: '11px 18px',
            borderRadius: 12,
            background: 'var(--accent)',
            color: 'var(--accent-on)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            minHeight: 44,
          }}
        >
          {primary.icon}
          {primary.label}
        </button>
      )}
    </div>
  );
}
