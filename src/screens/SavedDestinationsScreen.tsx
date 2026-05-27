import type { ReactNode } from 'react';
import { DestinationChip } from '../components/DestinationChip';
import {
  IconChevronLeft,
  IconNavigate,
  IconPlus,
  IconStar,
} from '../components/icons';
import type { SavedDestination } from '../lib/types';

export function SavedDestinationsScreen({
  destinations,
  onBack,
  onSearchDestination,
  onAdd,
  onRemove,
}: {
  destinations: SavedDestination[];
  onBack: () => void;
  onSearchDestination: (d: SavedDestination) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const empty = destinations.length === 0;

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
        title="Saved destinations"
        eyebrow={empty ? null : `${destinations.length} synced`}
        trailing={
          empty ? null : (
            <button
              type="button"
              onClick={onAdd}
              aria-label="Add destination"
              style={{
                appearance: 'none',
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'var(--accent-tint-strong)',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconPlus size={18} stroke={2.25} />
            </button>
          )
        }
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        {empty ? (
          <EmptyState
            icon={<IconStar size={28} stroke={1.5} />}
            title="No saved destinations"
            body={
              <>
                Name the places you go often — like{' '}
                <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                  Office
                </strong>{' '}
                or{' '}
                <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                  Mum's place
                </strong>{' '}
                — and trigger a search with one tap.
              </>
            }
            primary={{
              label: 'Add a destination',
              onClick: onAdd,
              icon: <IconPlus size={14} stroke={2.5} />,
            }}
          />
        ) : (
          <div style={{ paddingTop: 4 }}>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: 13,
                color: 'var(--text-2)',
                lineHeight: 1.5,
              }}
            >
              Tap a chip to find carparks near it. Hold to rename or remove.
            </p>

            <div
              className="psg-stagger"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {destinations.map((d) => (
                <DestinationChip
                  key={d.id}
                  d={d}
                  onSearch={() => onSearchDestination(d)}
                  onRemove={() => onRemove(d.id)}
                />
              ))}
              <button
                type="button"
                onClick={onAdd}
                style={{
                  appearance: 'none',
                  padding: '14px 14px',
                  borderRadius: 14,
                  background: 'transparent',
                  border: '1px dashed var(--line-strong)',
                  color: 'var(--text-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  minHeight: 92,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'var(--accent-tint)',
                    color: 'var(--accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconPlus size={15} stroke={2.25} />
                </span>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-1)',
                    letterSpacing: -0.1,
                  }}
                >
                  Add a destination
                </div>
              </button>
            </div>

            <div
              style={{
                marginTop: 22,
                padding: '12px 14px',
                background: 'var(--bg-2)',
                border: '0.5px solid var(--line)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span
                style={{
                  color: 'var(--accent)',
                  display: 'inline-flex',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <IconNavigate size={14} stroke={2} />
              </span>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-2)',
                  lineHeight: 1.45,
                }}
              >
                Saved destinations also appear as quick chips on the home
                screen so you can search them in a single tap.
              </div>
            </div>
          </div>
        )}
      </div>
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
  trailing?: ReactNode;
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
        {eyebrow && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--text-3)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </div>
        )}
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

function EmptyState({
  icon,
  title,
  body,
  primary,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  primary?: { label: string; onClick: () => void; icon?: ReactNode };
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
