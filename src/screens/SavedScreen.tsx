import { useMemo, useState, type ReactNode } from 'react';
import type { MergedSaveItem } from '../lib/types';
import { SavedFeedRow } from '../components/SavedFeedRow';
import {
  IconBookmark,
  IconChevronLeft,
  IconPlus,
  IconStar,
} from '../components/icons';

type Filter = 'all' | 'destination' | 'carpark';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'destination', label: 'Destinations' },
  { id: 'carpark', label: 'Carparks' },
];

const FILTER_KEY = 'psg.savedFilter';

function readPersistedFilter(): Filter {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY);
    if (raw === 'all' || raw === 'destination' || raw === 'carpark') return raw;
  } catch {
    /* ignore */
  }
  return 'all';
}

function writePersistedFilter(f: Filter) {
  try {
    sessionStorage.setItem(FILTER_KEY, f);
  } catch {
    /* ignore */
  }
}

export function SavedScreen({
  merged,
  destinationCount,
  carparkCount,
  onBack,
  onSearchDestination,
  onOpenCarpark,
  onRemoveDestination,
  onUnsaveCarpark,
  onAddDestination,
  onGoFindCarpark,
}: {
  merged: MergedSaveItem[];
  destinationCount: number;
  carparkCount: number;
  onBack: () => void;
  onSearchDestination: (item: MergedSaveItem & { kind: 'destination' }) => void;
  onOpenCarpark: (item: MergedSaveItem & { kind: 'carpark' }) => void;
  onRemoveDestination: (id: string) => void;
  onUnsaveCarpark: (id: string) => void;
  onAddDestination: () => void;
  onGoFindCarpark: () => void;
}) {
  const [filter, setFilterState] = useState<Filter>(() => readPersistedFilter());
  const setFilter = (f: Filter) => {
    setFilterState(f);
    writePersistedFilter(f);
  };

  const items = useMemo(
    () => (filter === 'all' ? merged : merged.filter((i) => i.kind === filter)),
    [merged, filter],
  );

  const counts: Record<Filter, number> = {
    all: merged.length,
    destination: destinationCount,
    carpark: carparkCount,
  };

  const empty = merged.length === 0;
  const filterEmpty = !empty && items.length === 0;

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
        title="Saved"
        eyebrow={empty ? null : `${merged.length} synced`}
        trailing={
          empty ? null : (
            <button
              type="button"
              onClick={onAddDestination}
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

      {/* Filter chips — visible whenever the feed isn't empty */}
      {!empty && (
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div
            className="psg-no-scrollbar"
            style={{ display: 'flex', gap: 6, overflowX: 'auto' }}
          >
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  style={{
                    appearance: 'none',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 13px',
                    borderRadius: 999,
                    border: active
                      ? '1px solid var(--accent)'
                      : '0.5px solid var(--line-strong)',
                    background: active
                      ? 'var(--accent-tint-strong)'
                      : 'var(--bg-1)',
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    letterSpacing: -0.1,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 120ms ease',
                  }}
                >
                  {f.label}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10.5,
                      color: active ? 'var(--accent)' : 'var(--text-3)',
                      letterSpacing: 0.3,
                    }}
                  >
                    {counts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        {empty ? (
          <SavedAllEmptyState
            onAddDestination={onAddDestination}
            onGoFindCarpark={onGoFindCarpark}
          />
        ) : filterEmpty ? (
          <FilterEmptyState
            filter={filter as 'destination' | 'carpark'}
            onAddDestination={onAddDestination}
            onGoFindCarpark={onGoFindCarpark}
          />
        ) : (
          <div
            className="psg-stagger"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingTop: 4,
            }}
          >
            {items.map((it) => (
              <SavedFeedRow
                key={`${it.kind}-${it.id}`}
                item={it}
                onSearchDestination={onSearchDestination}
                onOpenCarpark={onOpenCarpark}
                onRemoveDestination={onRemoveDestination}
                onUnsaveCarpark={onUnsaveCarpark}
              />
            ))}
            <div
              style={{
                marginTop: 6,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: 0.3,
              }}
            >
              Sorted by recency · live data on open
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

function SavedAllEmptyState({
  onAddDestination,
  onGoFindCarpark,
}: {
  onAddDestination: () => void;
  onGoFindCarpark: () => void;
}) {
  return (
    <div
      style={{
        padding: '32px 16px 24px',
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
        <IconBookmark filled size={28} stroke={1.5} />
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
        Nothing saved yet
      </h2>
      <p
        style={{
          margin: '8px 0 22px',
          fontSize: 13.5,
          color: 'var(--text-2)',
          lineHeight: 1.55,
          maxWidth: 300,
          textWrap: 'pretty',
        }}
      >
        Two ways to save: bookmark a carpark from the results list, or name a
        destination like{' '}
        <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
          Office
        </strong>{' '}
        for one-tap search.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          maxWidth: 280,
        }}
      >
        <button
          type="button"
          onClick={onAddDestination}
          style={{
            appearance: 'none',
            border: 0,
            padding: '11px 18px',
            borderRadius: 12,
            background: 'var(--accent)',
            color: 'var(--accent-on)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <IconPlus size={14} stroke={2.5} />
          Add a destination
        </button>
        <button
          type="button"
          onClick={onGoFindCarpark}
          style={{
            appearance: 'none',
            padding: '11px 18px',
            borderRadius: 12,
            background: 'var(--bg-1)',
            color: 'var(--text-1)',
            border: '0.5px solid var(--line-strong)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Find a carpark to save
        </button>
      </div>
    </div>
  );
}

function FilterEmptyState({
  filter,
  onAddDestination,
  onGoFindCarpark,
}: {
  filter: 'destination' | 'carpark';
  onAddDestination: () => void;
  onGoFindCarpark: () => void;
}) {
  const isDest = filter === 'destination';
  return (
    <div
      style={{
        padding: '32px 16px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'var(--bg-2)',
          color: 'var(--text-3)',
          border: '0.5px solid var(--line-strong)',
          marginBottom: 14,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isDest ? <IconStar size={22} stroke={1.5} /> : <IconBookmark size={22} stroke={1.5} />}
      </div>
      <h3
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: -0.2,
        }}
      >
        {isDest ? 'No saved destinations' : 'No saved carparks'}
      </h3>
      <p
        style={{
          margin: '6px 0 14px',
          fontSize: 12.5,
          color: 'var(--text-2)',
          lineHeight: 1.5,
          maxWidth: 280,
        }}
      >
        {isDest
          ? "Name a place like Office or Mum's place for one-tap search."
          : 'Tap the bookmark on any carpark in the results list.'}
      </p>
      <button
        type="button"
        onClick={isDest ? onAddDestination : onGoFindCarpark}
        style={{
          appearance: 'none',
          border: 0,
          padding: '9px 16px',
          borderRadius: 999,
          background: 'var(--accent)',
          color: 'var(--accent-on)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {isDest ? <IconPlus size={13} stroke={2.5} /> : null}
        {isDest ? 'Add a destination' : 'Find a carpark'}
      </button>
    </div>
  );
}
