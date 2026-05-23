import type { Carpark, DurationHours } from '../lib/types';
import {
  availabilityStatus,
  durationLabel,
  formatCost,
  formatDistance,
} from '../lib/availability';
import { AvailabilityDot, DurationStrip, LotTypeChips, OperatorBadge } from '../components/atoms';
import { RateTable } from '../components/RateTable';
import { WalkMap } from '../components/WalkMap';
import { IconChevronLeft, IconNavigate } from '../components/icons';

export function DetailScreen({
  cp,
  destination,
  duration,
  setDuration,
  onBack,
  onNavigate,
  refreshedSecondsAgo,
  degraded,
}: {
  cp: Carpark;
  destination: string;
  duration: DurationHours;
  setDuration: (v: DurationHours) => void;
  onBack: () => void;
  onNavigate: () => void;
  refreshedSecondsAgo: number | null;
  degraded: boolean;
}) {
  const status = degraded ? availabilityStatus(null) : availabilityStatus(cp.lotsAvailable);
  const cost = cp.estByHours[duration];

  const rateSource =
    cp.operator === 'HDB'
      ? 'HDB carpark tariff'
      : cp.operator === 'URA'
      ? 'URA Car_Park_Details'
      : 'LTA Datamall';

  return (
    <div
      className="psg-screen"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: '52px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
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
          }}
        >
          <IconChevronLeft size={18} stroke={2} />
        </button>
        <div style={{ flex: 1 }} />
        <button
          aria-label="Save carpark"
          style={{
            appearance: 'none',
            padding: '7px 12px',
            borderRadius: 999,
            background: 'var(--bg-1)',
            border: '0.5px solid var(--line-strong)',
            color: 'var(--text-2)',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 500,
            minHeight: 32,
          }}
        >
          Save
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 120px' }}>
        {/* Identity */}
        <div style={{ paddingTop: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              flexWrap: 'wrap',
              rowGap: 4,
            }}
          >
            <OperatorBadge operator={cp.operator} size="lg" />
            <LotTypeChips types={cp.lotTypes} />
            {cp.grace > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-3)',
                  letterSpacing: 0.4,
                  whiteSpace: 'nowrap',
                }}
              >
                · {cp.grace}-min grace
              </span>
            )}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.5,
              lineHeight: 1.1,
            }}
          >
            {cp.name}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{cp.block}</div>
        </div>

        {/* Stat cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 18,
          }}
        >
          <div
            style={{
              background: 'var(--bg-1)',
              border: '0.5px solid var(--line)',
              borderRadius: 14,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-3)',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Est. cost
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 30,
                fontWeight: 600,
                lineHeight: 1,
                color: 'var(--text-1)',
                letterSpacing: -0.6,
              }}
            >
              {formatCost(cost)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
              {durationLabel(duration)} stay
            </div>
          </div>
          <div
            style={{
              background: 'var(--bg-1)',
              border: '0.5px solid var(--line)',
              borderRadius: 14,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-3)',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              <AvailabilityDot status={status} size={6} />
              Available
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 30,
                fontWeight: 600,
                lineHeight: 1,
                color: degraded
                  ? 'var(--text-3)'
                  : status === 'full'
                  ? 'var(--bad)'
                  : status === 'limited'
                  ? 'var(--warn)'
                  : 'var(--text-1)',
                letterSpacing: -0.6,
              }}
            >
              {degraded ? '—' : cp.lotsAvailable}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
              {degraded ? 'of ? lots' : `of ${cp.lotsTotal} lots`}
            </div>
          </div>
        </div>

        {/* Walk map */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 8,
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                color: 'var(--text-3)',
                letterSpacing: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              Walk to {destination}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-2)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {cp.walkMin} min · {formatDistance(cp.walkMeters)}
            </div>
          </div>
          <WalkMap walkMin={cp.walkMin} walkMeters={cp.walkMeters} />
        </div>

        {/* Adjust duration */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--text-3)',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Adjust duration
          </div>
          <DurationStrip value={duration} onChange={setDuration} compact />
        </div>

        {/* Rate schedule */}
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--text-3)',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Rate schedule
          </div>
          <RateTable rates={cp.rates} />
        </div>

        {/* Meta */}
        <div
          style={{
            marginTop: 18,
            padding: '0 4px',
            fontSize: 11.5,
            color: 'var(--text-3)',
            lineHeight: 1.6,
          }}
        >
          {refreshedSecondsAgo == null
            ? 'Lot count refresh pending'
            : `Lot count last refreshed ${refreshedSecondsAgo}s ago`}
          <br />
          Rates from {rateSource}
        </div>
      </div>

      {/* Sticky navigate CTA */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '12px 16px 30px',
          background: 'linear-gradient(to top, var(--bg-0) 60%, rgba(0,0,0,0))',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <button
          onClick={onNavigate}
          style={{
            pointerEvents: 'auto',
            appearance: 'none',
            border: 0,
            width: '100%',
            padding: '15px 18px',
            background: 'var(--accent)',
            color: 'var(--accent-on)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: -0.1,
            cursor: 'pointer',
            boxShadow:
              '0 10px 28px rgba(46,227,194,0.30), 0 2px 6px rgba(0,0,0,0.10)',
            minHeight: 50,
          }}
        >
          <IconNavigate size={18} stroke={2} />
          Navigate · {cp.walkMin} min walk after parking
        </button>
      </div>
    </div>
  );
}
