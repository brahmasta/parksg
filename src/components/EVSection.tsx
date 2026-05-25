import { useState } from 'react';
import type { CarparkEV, EVConnector } from '../lib/types';
import {
  evSummary,
  groupConnectors,
  isEvStale,
  type ConnectorGroup,
} from '../lib/ev';
import { AvailabilityDot } from './atoms';
import { IconBolt, IconChevronDown, IconWarning } from './icons';

/**
 * Full EV-charging section for DetailScreen. Sits between the stat cards
 * and the walk map. Renders nothing when the carpark has no chargers —
 * silence is the correct answer per spec.
 *
 *   <EVSectionHeader>    label + operators + Updated/Stale timestamp
 *   {stale banner}       only when feed >5min old / unreachable
 *   <ChargerGroupCard>×N one per (plugType, current, kW, price) group
 *   <Attribution>        © Singapore Land Transport Authority
 */
export function EVSection({ ev }: { ev: CarparkEV | null | undefined }) {
  if (!ev || !ev.hasCharging) return null;
  const stale = isEvStale(ev);
  const groups = groupConnectors(ev.connectors ?? []);

  return (
    <div style={{ marginTop: 22 }}>
      <EVSectionHeader ev={ev} stale={stale} />

      {stale && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            marginBottom: 8,
            background: 'var(--warn-bg)',
            border: '0.5px solid var(--warn)',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--text-1)',
            lineHeight: 1.35,
          }}
        >
          <span style={{ color: 'var(--warn)', display: 'inline-flex' }}>
            <IconWarning size={14} stroke={2} />
          </span>
          Live connector status unavailable — tariff &amp; specs shown
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map((g) => (
          <ChargerGroupCard key={groupKey(g)} group={g} stale={stale} />
        ))}
      </div>

      <div
        style={{
          marginTop: 10,
          padding: '0 4px',
          fontSize: 10.5,
          color: 'var(--text-3)',
          lineHeight: 1.5,
          fontFamily: 'var(--font-mono)',
          letterSpacing: 0.2,
        }}
      >
        EV charging data © Singapore Land Transport Authority
      </div>
    </div>
  );
}

function groupKey(g: ConnectorGroup): string {
  return `${g.plugType}-${g.current}-${g.kw}-${g.price}-${g.priceType}`;
}

// ────────────────────────────────────────────────────────────────────
// Section header
// ────────────────────────────────────────────────────────────────────

function EVSectionHeader({ ev, stale }: { ev: CarparkEV; stale: boolean }) {
  const summary = evSummary(ev);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--text-3)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
          <IconBolt size={12} stroke={2.25} />
        </span>
        EV Charging
        {ev.operators && ev.operators.length > 0 && (
          <>
            <span style={{ color: 'var(--text-3)' }}>·</span>
            <span style={{ textTransform: 'none', letterSpacing: 0.3 }}>
              {ev.operators.join(' · ')}
            </span>
          </>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: stale ? 'var(--warn)' : 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}
        aria-label={
          stale
            ? `Live connector status stale, ${ev.lastUpdatedMin ?? '?'} minutes ago`
            : `Updated ${ev.lastUpdatedMin ?? 0} minutes ago`
        }
      >
        {summary &&
          (stale
            ? `Stale · ${ev.lastUpdatedMin ?? '?'}m ago`
            : `Updated ${ev.lastUpdatedMin ?? 0}m ago`)}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Charger group card
// ────────────────────────────────────────────────────────────────────

function ChargerGroupCard({
  group,
  stale,
}: {
  group: ConnectorGroup;
  stale: boolean;
}) {
  const [open, setOpen] = useState(false);
  const avail = group.connectors.filter((c) => c.status === 'Available').length;
  const total = group.connectors.length;
  const positions = group.connectors.map((c) => c.position);
  const positionSummary =
    positions.length === 0
      ? ''
      : positions.length <= 2
        ? positions.join(' · ')
        : `${positions[0]} + ${positions.length - 1} more`;

  const dotStatus = stale
    ? 'unknown'
    : avail > 0
      ? 'available'
      : 'full';
  const isDC = group.current === 'DC';

  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${group.current} ${group.plugType} ${group.kw} kilowatt, ${formatPrice(
          group.price,
          group.priceType,
        )}, ${stale ? 'live status unavailable' : `${avail} of ${total} available`}, ${
          open ? 'collapse' : 'expand'
        }`}
        style={{
          appearance: 'none',
          border: 0,
          background: 'transparent',
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          cursor: 'pointer',
          color: 'var(--text-1)',
          minHeight: 44,
        }}
      >
        {/* Spec line: [AC|DC] · plug · kW           $X/kWh */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: isDC ? 'var(--accent)' : 'var(--text-2)',
                background: isDC ? 'var(--accent-tint)' : 'var(--bg-3)',
                border: '0.5px solid ' + (isDC ? 'var(--accent)' : 'var(--line-strong)'),
                padding: '2px 5px',
                borderRadius: 3,
                lineHeight: 1,
              }}
            >
              {group.current}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-1)',
                letterSpacing: -0.1,
                whiteSpace: 'nowrap',
              }}
            >
              {group.plugType}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-2)',
                whiteSpace: 'nowrap',
              }}
            >
              {group.kw} kW
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-1)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            ${group.price.toFixed(2)}
            <span style={{ color: 'var(--text-3)' }}>{group.priceType}</span>
          </div>
        </div>

        {/* Availability + position summary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 500,
              color: stale
                ? 'var(--text-3)'
                : avail > 0
                  ? 'var(--text-1)'
                  : 'var(--bad)',
            }}
          >
            <AvailabilityDot status={dotStatus} size={7} />
            {stale ? '— available' : `${avail} of ${total} available`}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              minWidth: 0,
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 140,
              }}
            >
              {positionSummary}
            </span>
            <span
              style={{
                transform: `rotate(${open ? 180 : 0}deg)`,
                transition: 'transform 180ms ease',
                display: 'inline-flex',
                color: 'var(--text-3)',
              }}
            >
              <IconChevronDown size={13} stroke={2} />
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div
          style={{
            borderTop: '0.5px solid var(--line)',
            padding: '6px 14px 12px',
          }}
        >
          {group.connectors.map((c, i) => (
            <ConnectorRow key={c.id} connector={c} stale={stale} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorRow({
  connector,
  stale,
  index,
}: {
  connector: EVConnector;
  stale: boolean;
  index: number;
}) {
  const dotStatus = stale
    ? 'unknown'
    : connector.status === 'Available'
      ? 'available'
      : connector.status === 'Occupied'
        ? 'limited'
        : 'full';
  const labelColor = stale
    ? 'var(--text-3)'
    : connector.status === 'Available'
      ? 'var(--text-1)'
      : connector.status === 'Occupied'
        ? 'var(--warn)'
        : 'var(--bad)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 0',
        borderTop: index > 0 ? '0.5px solid var(--line)' : 'none',
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-2)',
        }}
      >
        {connector.position}
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: labelColor,
        }}
      >
        <AvailabilityDot status={dotStatus} size={6} />
        {stale ? 'Unknown' : connector.status}
      </div>
    </div>
  );
}

function formatPrice(price: number, priceType: '/kWh' | '/h'): string {
  return `${price.toFixed(2)} per ${priceType === '/h' ? 'hour' : 'kilowatt-hour'}`;
}
