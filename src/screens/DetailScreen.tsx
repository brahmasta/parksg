import { useCallback, useState } from 'react';
import { track } from '@vercel/analytics/react';
import type { Carpark, DurationHours } from '../lib/types';
import { isStaleRates } from '../lib/rateSource';
import {
  MAPS_PROVIDER_LABELS,
  availableProviders,
  getLastProvider,
  mapsDirectionsUrl,
  setLastProvider,
  type MapsProvider,
} from '../lib/maps';
import { isApplePlatform } from '../lib/platform';
import { NavigateSheet } from '../components/NavigateSheet';
import { NavigateModal } from '../components/NavigateModal';
import {
  availabilityColorVar,
  availabilityStatus,
  durationLabel,
  formatCost,
  formatDistance,
  googleRateHint,
  lotsDisplay,
} from '../lib/availability';
import { AvailabilityDot, DurationStrip, GoogleBadge, LotTypeChips, OperatorBadge } from '../components/atoms';
import { StayPlanner } from '../components/StayPlanner';
import { estCostForStay, fmtDuration, type Stay } from '../lib/stay';
import { EVSection } from '../components/EVSection';
import { PoweredByGoogle } from '../components/PoweredByGoogle';
import { RateTable } from '../components/RateTable';
import { WalkMap } from '../components/WalkMap';
import { RealWalkMap } from '../components/RealWalkMap';
import {
  IconBookmark,
  IconChevronDown,
  IconChevronLeft,
  IconNavigate,
  IconWarning,
} from '../components/icons';
import { useWalkRoute } from '../hooks/useWalkRoute';

export function DetailScreen({
  cp,
  destination,
  destinationCoords,
  duration = 1,
  setDuration,
  stay,
  setStay,
  onBack,
  refreshedSecondsAgo,
  degraded,
  saved,
  onToggleSave,
  cost: costOverride,
  durationText,
  hideDurationStrip = false,
  navVariant = 'sheet',
  hideWalkMap = false,
}: {
  cp: Carpark;
  destination: string;
  destinationCoords: [number, number] | null;
  /** Legacy preset duration — used only when `stay` is not provided. */
  duration?: DurationHours;
  setDuration?: (v: DurationHours) => void;
  /** Planned stay — when provided, drives the cost and renders a StayPlanner in
   * the adjust-duration slot (unless hideDurationStrip). */
  stay?: Stay;
  setStay?: (s: Stay) => void;
  onBack: () => void;
  refreshedSecondsAgo: number | null;
  degraded: boolean;
  saved: boolean;
  onToggleSave: () => void;
  /** Explicit cost (dollars) for an arbitrary stay; null = unknown. Falls back
   * to the preset estByHours[duration] when omitted and no `stay`. */
  cost?: number | null;
  /** Caption under the cost, e.g. "2h 30m stay". */
  durationText?: string;
  /** Hide the duration control entirely (desktop rail drives it via StayPlanner). */
  hideDurationStrip?: boolean;
  /** Navigation picker style: bottom 'sheet' (mobile) or centered 'modal' (desktop). */
  navVariant?: 'sheet' | 'modal';
  /** Hide the in-panel walk diagram (desktop shows the walk line on the main map
   * instead, so the path isn't drawn twice). */
  hideWalkMap?: boolean;
}) {
  const status = degraded ? availabilityStatus(null) : availabilityStatus(cp.lotsAvailable);

  // Navigation: open the carpark entrance in a maps app. First time shows the
  // provider picker; after that the primary button repeats the last-used app
  // (the chevron always re-opens the picker). See src/lib/maps.ts.
  const [navSheetOpen, setNavSheetOpen] = useState(false);
  const [lastProvider, setLastProviderState] = useState<MapsProvider | null>(() => getLastProvider());

  const openProvider = useCallback(
    (provider: MapsProvider) => {
      const [lat, lng] = cp.coords.entrance;
      const url = mapsDirectionsUrl(provider, lat, lng);
      // Use a real anchor click rather than window.open — anchors with
      // target=_blank are never treated as a popup (so they're not blocked) and
      // open reliably across browsers.
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setLastProvider(provider);
      setLastProviderState(provider);
      track('navigate', { provider, carpark: cp.id });
    },
    [cp],
  );

  const onNavigatePrimary = useCallback(() => {
    if (lastProvider && availableProviders(isApplePlatform()).includes(lastProvider)) {
      openProvider(lastProvider);
    } else {
      setNavSheetOpen(true);
    }
  }, [lastProvider, openProvider]);
  const lotsInfo = lotsDisplay(cp.lotsAvailable, cp.lotsTotal, degraded);
  const isGoogle = cp.source === 'GOOGLE';
  const cost = stay
    ? estCostForStay(cp, stay)
    : costOverride !== undefined
      ? costOverride
      : cp.estByHours[duration];
  const costUnknown = isGoogle || cost == null;
  const effectiveDurationText = stay
    ? `${fmtDuration(stay.hours)} stay`
    : (durationText ?? `${durationLabel(duration)} stay`);

  // Live walking route: starts as haversine, upgrades to OneMap when the
  // /api/onemap-route proxy returns. Silent fallback on any error.
  const walk = useWalkRoute(
    destinationCoords,
    cp.coords.entrance,
    cp.walkMeters,
    cp.walkMin,
  );

  // Source attribution for the rate schedule. Shared with the Results card +
  // CHEAPEST ranking via isStaleRates so all three agree on what's "stale 2018".
  const isDatagovRates = !isGoogle && isStaleRates(cp);

  const rateSource = isGoogle
    ? 'Google Maps · rates not provided'
    : isDatagovRates
    ? 'data.gov.sg LTA Carpark Rates (Nov 2018 snapshot)'
    : cp.operator === 'HDB'
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
        {!isGoogle && (
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved' : 'Save carpark'}
            style={{
              appearance: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px 7px 10px',
              borderRadius: 999,
              background: saved
                ? 'var(--accent-tint-strong)'
                : 'var(--bg-1)',
              border: saved
                ? '1px solid var(--accent)'
                : '0.5px solid var(--line-strong)',
              color: saved ? 'var(--accent)' : 'var(--text-2)',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: -0.1,
              minHeight: 32,
              transition: 'all 140ms ease',
            }}
          >
            <IconBookmark filled={saved} size={14} stroke={2} />
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
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
            {isGoogle ? <GoogleBadge /> : <OperatorBadge operator={cp.operator} size="lg" />}
            {!isGoogle && <LotTypeChips types={cp.lotTypes} />}
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

        {/* Google supplementary — unverified-data banner */}
        {isGoogle && (
          <div style={{ marginTop: 14 }}>
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-2)',
                border: '0.5px solid var(--line)',
                borderRadius: 10,
                color: 'var(--text-1)',
                fontSize: 12.5,
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0, marginTop: 1 }}>
                <IconWarning size={16} stroke={2} />
              </span>
              <span>
                Found via Google Maps to fill a coverage gap. Rates, capacity and
                live availability aren't provided — verify at the carpark.
              </span>
            </div>
            <PoweredByGoogle />
          </div>
        )}

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
              {costUnknown ? '—' : formatCost(cost as number)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
              {isGoogle ? googleRateHint(cp.googleParking) : effectiveDurationText}
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
              {lotsInfo.count}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>
              {lotsInfo.secondary}
              {lotsInfo.pctFree != null && ` · ${lotsInfo.pctFree}% free`}
            </div>
            {lotsInfo.pctFree != null && (
              // Capacity bar — a quick sanity-check on the live count against
              // the known total. Filled portion = free fraction, status-tinted.
              <div
                aria-hidden
                style={{
                  marginTop: 8,
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--bg-3)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${lotsInfo.pctFree}%`,
                    height: '100%',
                    background: availabilityColorVar(status),
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* EV charging (between stat cards and walk map per E8 design spec). */}
        <EVSection ev={cp.ev} />

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
                transition: 'opacity 200ms ease',
                opacity: walk.source === 'onemap' ? 1 : 0.78,
              }}
              title={walk.source === 'onemap' ? 'Walking route from OneMap' : 'Approximate (straight-line)'}
            >
              {walk.minutes} min · {formatDistance(walk.meters)}
            </div>
          </div>
          {hideWalkMap ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
              Walking route shown on the map.
            </div>
          ) : destinationCoords && walk.source === 'onemap' && walk.geometry.length >= 2 ? (
            <RealWalkMap
              origin={cp.coords.entrance}
              destination={destinationCoords}
              geometry={walk.geometry}
              walkMin={walk.minutes}
              walkMeters={walk.meters}
            />
          ) : (
            <WalkMap walkMin={walk.minutes} walkMeters={walk.meters} />
          )}
        </div>

        {/* Adjust duration — StayPlanner when a `stay` is supplied (mobile +
            desktop parity); legacy preset strip otherwise. Hidden entirely on
            the desktop rail, which has its own StayPlanner. */}
        {!hideDurationStrip &&
          (stay && setStay ? (
            <div style={{ marginTop: 20 }}>
              <StayPlanner stay={stay} onChange={setStay} collapsible />
            </div>
          ) : setDuration ? (
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
          ) : null)}

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
          {isGoogle ? (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--bg-2)',
                border: '0.5px solid var(--line)',
                borderRadius: 12,
                fontSize: 12.5,
                color: 'var(--text-2)',
                lineHeight: 1.45,
              }}
            >
              Rate information isn't available from Google. Check the signage or
              the operator's app at the gantry.
            </div>
          ) : (
            <RateTable rates={cp.rates} />
          )}
          {isDatagovRates && (
            <div
              role="status"
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: 'var(--warn-bg)',
                border: '0.5px solid var(--warn)',
                borderRadius: 10,
                color: 'var(--text-1)',
                fontSize: 12.5,
                lineHeight: 1.4,
              }}
            >
              <span
                style={{ color: 'var(--warn)', display: 'inline-flex', flexShrink: 0 }}
              >
                <IconWarning size={16} stroke={2} />
              </span>
              <span>
                Rates may be outdated — sourced from a 2018 LTA snapshot.
                Check at the gantry before parking.
              </span>
            </div>
          )}
        </div>

        {/* Save reassurance — explains where the save lives (not for Google,
            which is view-only and never saved). */}
        {!isGoogle && (
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            background: saved ? 'var(--accent-tint)' : 'var(--bg-2)',
            border: '0.5px solid ' + (saved ? 'var(--accent)' : 'var(--line)'),
            borderRadius: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            transition: 'all 180ms ease',
          }}
        >
          <span
            style={{
              color: saved ? 'var(--accent)' : 'var(--text-3)',
              display: 'inline-flex',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            <IconBookmark filled={saved} size={15} stroke={1.75} />
          </span>
          <div
            style={{
              fontSize: 12.5,
              color: saved ? 'var(--text-1)' : 'var(--text-2)',
              lineHeight: 1.45,
            }}
          >
            {saved ? (
              <>
                Saved to your account. Find it any time under{' '}
                <strong style={{ fontWeight: 600 }}>Saved</strong>.
              </>
            ) : (
              <>
                Tap{' '}
                <strong style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                  Save
                </strong>{' '}
                to keep this carpark on your account — it'll show up here on
                every device.
              </>
            )}
          </div>
        </div>
        )}

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
          {isGoogle
            ? 'Live lot count not available'
            : refreshedSecondsAgo == null
            ? 'Lot count refresh pending'
            : `Lot count last refreshed ${refreshedSecondsAgo}s ago`}
          <br />
          Rates from {rateSource}
          {isGoogle && cp.placeId && (
            <>
              <br />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${cp.coords.entrance[0]},${cp.coords.entrance[1]}&query_place_id=${cp.placeId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-on)', textDecoration: 'underline' }}
              >
                Open in Google Maps
              </a>
            </>
          )}
          {cp.ev?.hasCharging && (
            <>
              <br />
              EV status refreshes every 5 min · Private chargers not shown
            </>
          )}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onNavigatePrimary}
            style={{
              pointerEvents: 'auto',
              appearance: 'none',
              border: 0,
              flex: 1,
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
            {lastProvider ? `Navigate · ${MAPS_PROVIDER_LABELS[lastProvider]}` : 'Navigate'}
          </button>
          <button
            type="button"
            aria-label="Choose navigation app"
            onClick={() => setNavSheetOpen(true)}
            style={{
              pointerEvents: 'auto',
              appearance: 'none',
              width: 50,
              flexShrink: 0,
              borderRadius: 14,
              border: '0.5px solid var(--line-strong)',
              background: 'var(--bg-1)',
              color: 'var(--text-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              minHeight: 50,
            }}
          >
            <IconChevronDown size={18} stroke={2} />
          </button>
        </div>
      </div>

      {navVariant === 'modal' ? (
        <NavigateModal
          open={navSheetOpen}
          onClose={() => setNavSheetOpen(false)}
          carparkName={cp.name}
          onPick={openProvider}
        />
      ) : (
        <NavigateSheet
          open={navSheetOpen}
          onClose={() => setNavSheetOpen(false)}
          carparkName={cp.name}
          onPick={openProvider}
        />
      )}
    </div>
  );
}
