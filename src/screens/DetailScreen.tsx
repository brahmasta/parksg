import { useCallback, useState } from 'react';
import type { Carpark, DurationHours, User } from '../lib/types';
import { isStaleRates } from '../lib/rateSource';
import {
  MAPS_PROVIDER_LABELS,
  availableProviders,
  getLastProvider,
  type MapsProvider,
} from '../lib/maps';
import { isApplePlatform } from '../lib/platform';
import { NavigateSheet } from '../components/NavigateSheet';
import { NavigateModal } from '../components/NavigateModal';
import { openDirections } from '../hooks/useCarparkNavigation';
import { siteOrigin } from '../lib/apiBase';
import { shareLink } from '../lib/shareResults';
import { ReportInaccuracyDialog } from '../components/ReportInaccuracyDialog';
import { SuggestEditDialog } from '../components/SuggestEditDialog';
import type { EditableRate } from '../components/rateGrid';
import { CheckinCard } from '../components/CheckinCard';
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
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconNavigate,
  IconShare,
  IconWarning,
} from '../components/icons';
import { useWalkRoute } from '../hooks/useWalkRoute';

/** Flatten a carpark's display rate buckets into editable rows for the
 * "Suggest an edit" dialog (cents fields already live on the frontend RateRow). */
function toEditableRates(cp: Carpark): EditableRate[] {
  const buckets: [keyof Carpark['rates'], EditableRate['day_type']][] = [
    ['weekday', 'WEEKDAY'],
    ['saturday', 'SAT'],
    ['sundayPH', 'SUN_PH'],
  ];
  const out: EditableRate[] = [];
  for (const [key, dayType] of buckets) {
    for (const r of cp.rates[key] ?? []) {
      out.push({
        day_type: dayType,
        start_time: r.startTime ?? null,
        end_time: r.endTime ?? null,
        first_hour_cents: r.firstHourCents ?? null,
        first_block_minutes: r.firstBlockMinutes ?? null,
        per_block_cents: r.perBlockCents ?? null,
        block_minutes: r.blockMinutes ?? null,
        per_entry_cents: r.perEntryCents ?? null,
        cap_cents: r.capCents ?? null,
        grace_minutes: r.graceMinutes ?? null,
        system: r.system ?? 'EPS',
      });
    }
  }
  return out;
}

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
  user = null,
  onRequireSignIn,
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
  /** Signed-in user (enables crowdsourced check-ins). */
  user?: User | null;
  /** Prompt sign-in when a signed-out user taps a check-in button. */
  onRequireSignIn?: () => void;
}) {
  const status = degraded ? availabilityStatus(null) : availabilityStatus(cp.lotsAvailable);

  // Navigation: open the carpark entrance in a maps app. First time shows the
  // provider picker; after that the primary button repeats the last-used app
  // (the chevron always re-opens the picker). See src/lib/maps.ts.
  const [navSheetOpen, setNavSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [lastProvider, setLastProviderState] = useState<MapsProvider | null>(() => getLastProvider());

  const openProvider = useCallback(
    (provider: MapsProvider) => {
      openDirections(cp, provider, 'detail');
      setLastProviderState(provider);
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

  // Share this carpark + the walk distance to the destination. The link reopens
  // the carpark in the same destination context for the recipient (App parses
  // `?cp=&to=&dest=`). Uses the native share sheet where available, else copies.
  const onShare = useCallback(async () => {
    const origin = siteOrigin();
    const params = new URLSearchParams();
    // Ephemeral Google carparks can't be re-fetched by id, so share the
    // destination only — the recipient lands on its live results.
    if (!isGoogle) params.set('cp', cp.id);
    if (destinationCoords) {
      params.set('to', `${destinationCoords[0].toFixed(6)},${destinationCoords[1].toFixed(6)}`);
      if (destination) params.set('dest', destination);
    }
    const qs = params.toString();
    const url = qs ? `${origin}/?${qs}` : `${origin}/`;

    const walkBit =
      destinationCoords && cp.walkMin != null
        ? ` — ${cp.walkMin} min (${formatDistance(cp.walkMeters)}) walk to ${destination}`
        : '';
    const costBit =
      !costUnknown && cost != null ? ` · ~${formatCost(cost)} for ${effectiveDurationText}` : '';
    const text = `Park at ${cp.name}${walkBit}${costBit}`;

    const outcome = await shareLink({ title: `Parking: ${cp.name}`, text, url });
    if (outcome === 'shared' || outcome === 'cancelled') return;
    setShareNote(outcome === 'copied' ? 'Link copied' : 'Could not copy link');
    window.setTimeout(() => setShareNote(null), 1800);
  }, [cp, destination, destinationCoords, cost, costUnknown, effectiveDurationText, isGoogle]);

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
          padding: 'var(--screen-top) 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          data-track="nav_back"
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
          type="button"
          data-track="detail_share"
          onClick={() => void onShare()}
          aria-label="Share carpark"
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
            marginRight: 8,
          }}
        >
          <IconShare size={16} stroke={2} />
        </button>
        {!isGoogle && (
          <button
            type="button"
            data-track="detail_save"
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
          {/* Vehicle lot types — own row so the spelled-out chips don't push
              the operator/grace line into an awkward wrap on a phone. */}
          {!isGoogle && cp.lotTypes.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
                flexWrap: 'wrap',
                rowGap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-3)',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                Lots for
              </span>
              <LotTypeChips types={cp.lotTypes} counts={cp.lotCounts} />
            </div>
          )}
          {cp.heightLimitM != null && (
            <div
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-3)',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                Height limit
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                {fmtHeight(cp.heightLimitM)}
              </span>
              {carParkKind(cp.carParkType) && (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  · {carParkKind(cp.carParkType)}
                </span>
              )}
            </div>
          )}
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

        {/* Adjust duration — right under the cost it drives. StayPlanner when a
            `stay` is supplied (phone and desktop rail); legacy preset strip
            otherwise. */}
        {!hideDurationStrip &&
          (stay && setStay ? (
            <div style={{ marginTop: 12 }}>
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
          {cp.motorcycleRates && (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  color: 'var(--text-3)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  margin: '16px 0 10px',
                }}
              >
                Motorcycle rates
              </div>
              <RateTable rates={cp.motorcycleRates} />
              {isCommunityRates(cp.motorcycleRates) && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.45 }}>
                  Reported by riders on the r/singapore motorcycle parking map, Dec 2022.
                  Prices may have changed.
                </div>
              )}
            </>
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
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
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

        {/* Crowdsourced "is it full now?" — community signal + report buttons.
            Below the rates and details: it's a contribution, not something a
            driver needs before deciding, so it sits with the other feedback
            actions at the foot of the page. */}
        <CheckinCard
          carparkId={cp.id}
          user={user}
          onRequireSignIn={onRequireSignIn ?? (() => {})}
          hasSensor={cp.lotsAvailable != null}
        />

        {/* Suggest an edit — structured rate/lots proposal for admin review.
            Hidden for Google carparks (no DB row to edit). Open to everyone. */}
        {!isGoogle && (
          <button
            type="button"
            data-track="suggest_edit"
            onClick={() => setSuggestOpen(true)}
            style={{
              appearance: 'none',
              width: '100%',
              marginTop: 16,
              padding: '11px 14px',
              borderRadius: 12,
              border: '0.5px solid var(--line-strong)',
              background: 'var(--bg-1)',
              color: 'var(--text-1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <IconWarning size={15} stroke={2} />
            Suggest an edit
          </button>
        )}

        {/* Report a data inaccuracy — opens the report form. */}
        <button
          type="button"
          data-track="report_inaccuracy"
          onClick={() => setReportOpen(true)}
          style={{
            appearance: 'none',
            width: '100%',
            marginTop: 16,
            padding: '11px 14px',
            borderRadius: 12,
            border: '0.5px solid color-mix(in srgb, var(--bad, #C0392B) 40%, transparent)',
            background: 'color-mix(in srgb, var(--bad, #C0392B) 8%, transparent)',
            color: 'var(--bad, #C0392B)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <IconWarning size={15} stroke={2} />
          Report data inaccuracy
        </button>
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
            data-track="detail_navigate"
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
                'var(--shadow-raised)',
              minHeight: 50,
            }}
          >
            <IconNavigate size={18} stroke={2} />
            {lastProvider ? `Navigate · ${MAPS_PROVIDER_LABELS[lastProvider]}` : 'Navigate'}
          </button>
          <button
            type="button"
            data-track="detail_choose_nav_app"
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

      <ReportInaccuracyDialog
        key={reportOpen ? 'report-open' : 'report-closed'}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        variant={navVariant}
        carpark={{ id: cp.id, name: cp.name, source: isGoogle ? 'GOOGLE' : cp.operator }}
      />

      {!isGoogle && (
        <SuggestEditDialog
          key={suggestOpen ? 'suggest-open' : 'suggest-closed'}
          open={suggestOpen}
          onClose={() => setSuggestOpen(false)}
          variant={navVariant}
          carpark={{ id: cp.id, name: cp.name, source: cp.operator }}
          currentTotalLots={cp.lotsTotal > 0 ? cp.lotsTotal : null}
          currentHeightLimitM={cp.heightLimitM ?? null}
          initialRates={toEditableRates(cp)}
          user={user}
        />
      )}

      {shareNote && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 96,
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 15px',
            borderRadius: 999,
            background: 'var(--text-1)',
            color: 'var(--bg-0)',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
          }}
        >
          <IconCheck size={14} stroke={2.5} />
          {shareNote}
        </div>
      )}
    </div>
  );
}

/** 2.15 → "2.15 m", 2 → "2.0 m". */
function fmtHeight(m: number): string {
  return `${m % 1 === 0 ? m.toFixed(1) : String(m)} m`;
}

/** HDB's "MULTI-STOREY CAR PARK" → "Multi-storey"; other types → null. */
function carParkKind(type: string | undefined): string | null {
  if (!type) return null;
  const t = type.toUpperCase();
  if (t.includes('BASEMENT')) return 'Basement';
  if (t.includes('MULTI-STOREY')) return 'Multi-storey';
  if (t.includes('MECHANISED')) return 'Mechanised';
  if (t.includes('COVERED')) return 'Covered';
  return null;
}

/** True when a rate schedule comes from the community motorcycle map. */
function isCommunityRates(rates: Carpark['rates']): boolean {
  return [...rates.weekday, ...rates.saturday, ...rates.sundayPH].some((r) => r.source === 'COMMUNITY');
}
