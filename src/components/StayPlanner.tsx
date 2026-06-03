import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  STAY_MAX_HOURS,
  STAY_MIN_HOURS,
  clampHours,
  effectiveStart,
  fmtClock,
  fmtDay,
  fmtDuration,
  roundedSoon,
  toDateInput,
  toTimeInput,
  type Stay,
  type StartMode,
} from '../lib/stay';
import { MonoLabel } from './atoms';
import { IconArrowRight, IconCalendar, IconCar, IconChevronDown, IconClock, IconMinus, IconPlus } from './icons';

/**
 * "When are you parking, and for how long?" — a start time (Now / Later +
 * date-time) and a duration dialed in 30-min steps, hard-capped at 24h. Emits
 * the full Stay upward; the results re-rank costs from `stay.hours`.
 *
 * `collapsible` (mobile) turns the header into a toggle that shows a compact
 * summary when collapsed, so it doesn't dominate the screen (esp. map view).
 */
export function StayPlanner({
  stay,
  onChange,
  collapsible = false,
  defaultOpen = false,
}: {
  stay: Stay;
  onChange: (s: Stay) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(collapsible ? defaultOpen : true);
  const bodyVisible = !collapsible || open;
  const { startMode, startAt, hours } = stay;
  const start = effectiveStart(stay);
  const endDate = new Date(start.getTime() + hours * 3600000);

  const setMode = (m: StartMode) => {
    if (m === 'later' && startMode === 'now') {
      onChange({ startMode: 'later', startAt: roundedSoon(), hours });
    } else {
      onChange({ ...stay, startMode: m });
    }
  };

  const stepHours = (delta: number) => onChange({ ...stay, hours: clampHours(hours + delta) });

  const setDatePart = (dateStr: string) => {
    if (!dateStr) return;
    const [y, mo, d] = dateStr.split('-').map(Number);
    const next = new Date(startAt);
    next.setFullYear(y, mo - 1, d);
    onChange({ ...stay, startAt: next });
  };
  const setTimePart = (timeStr: string) => {
    if (!timeStr) return;
    const [h, mi] = timeStr.split(':').map(Number);
    const next = new Date(startAt);
    next.setHours(h, mi, 0, 0);
    onChange({ ...stay, startAt: next });
  };

  const pct = ((hours - STAY_MIN_HOURS) / (STAY_MAX_HOURS - STAY_MIN_HOURS)) * 100;
  const atMax = hours >= STAY_MAX_HOURS;
  const atMin = hours <= STAY_MIN_HOURS;

  return (
    <div style={{ background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 16, padding: collapsible && !open ? '14px 18px' : 18, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      {/* Header — a toggle when collapsible, with a compact summary when closed. */}
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            appearance: 'none', border: 0, background: 'transparent', padding: 0, width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            cursor: 'pointer', marginBottom: open ? 12 : 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ color: 'var(--text-2)', display: 'inline-flex', flexShrink: 0 }}><IconClock size={15} stroke={2} /></span>
            <MonoLabel>Plan your stay</MonoLabel>
            {!open && (
              <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                · {fmtDuration(hours)} · {startMode === 'now' ? 'Now' : `${fmtDay(start)} ${fmtClock(start)}`}
              </span>
            )}
          </span>
          <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
            <IconChevronDown size={18} stroke={2} />
          </span>
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-2)', display: 'inline-flex' }}><IconClock size={15} stroke={2} /></span>
            <MonoLabel>Plan your stay</MonoLabel>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', letterSpacing: 0.4, padding: '2px 7px', borderRadius: 5, background: 'var(--bg-3)' }}>MAX 24H</span>
        </div>
      )}

      {bodyVisible && (
        <>

      {/* Now / Later */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, background: 'var(--bg-2)', borderRadius: 11, border: '0.5px solid var(--line)' }}>
        {([['now', 'Start now'], ['later', 'Start later']] as [StartMode, string][]).map(([m, label]) => {
          const active = startMode === m;
          return (
            <button key={m} onClick={() => setMode(m)} style={{ appearance: 'none', border: 0, borderRadius: 8, padding: '9px 0', background: active ? 'var(--bg-1)' : 'transparent', color: active ? 'var(--text-1)' : 'var(--text-2)', fontSize: 13.5, fontWeight: active ? 600 : 500, cursor: 'pointer', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 120ms ease' }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Later → date + time */}
      {startMode === 'later' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 8, marginTop: 10 }}>
          <label style={fieldStyle}>
            <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><IconCalendar size={15} stroke={1.75} /></span>
            <input type="date" value={toDateInput(startAt)} min={toDateInput(new Date())} onChange={(e) => setDatePart(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><IconClock size={15} stroke={1.75} /></span>
            <input type="time" value={toTimeInput(startAt)} step={1800} onChange={(e) => setTimePart(e.target.value)} style={inputStyle} />
          </label>
        </div>
      )}

      {/* Duration */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500, marginBottom: 4, whiteSpace: 'nowrap' }}>How long?</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1, color: 'var(--text-1)' }}>{fmtDuration(hours)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StepBtn disabled={atMin} onClick={() => stepHours(-0.5)} label="Decrease duration"><IconMinus size={17} stroke={2.5} /></StepBtn>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', width: 46, textAlign: 'center' }}>30 min</span>
            <StepBtn disabled={atMax} onClick={() => stepHours(0.5)} label="Increase duration"><IconPlus size={17} stroke={2.5} /></StepBtn>
          </div>
        </div>

        {/* Slider */}
        <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 6, borderRadius: 999, background: 'var(--bg-3)' }} />
          <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
          <input
            type="range"
            min={STAY_MIN_HOURS}
            max={STAY_MAX_HOURS}
            step={0.5}
            value={hours}
            onChange={(e) => onChange({ ...stay, hours: clampHours(parseFloat(e.target.value)) })}
            aria-label="Parking duration in hours"
            style={{ position: 'absolute', left: 0, right: 0, width: '100%', margin: 0, appearance: 'none', background: 'transparent', cursor: 'pointer', height: 28 }}
          />
          <span style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: 999, background: 'var(--bg-1)', border: '2px solid var(--accent)', boxShadow: '0 2px 6px rgba(0,0,0,0.18)', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
          <span>30m</span><span>12h</span><span>24h</span>
        </div>

        {/* Quick presets */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 8, 24].map((h) => {
            const active = hours === h;
            return (
              <button key={h} onClick={() => onChange({ ...stay, hours: h })} aria-pressed={active} style={{ appearance: 'none', padding: '5px 11px', fontSize: 12.5, borderRadius: 999, cursor: 'pointer', fontWeight: active ? 600 : 500, border: active ? '1px solid var(--accent)' : '0.5px solid var(--line-strong)', background: active ? 'var(--accent-tint-strong)' : 'var(--bg-1)', color: active ? 'var(--accent-on)' : 'var(--text-2)', transition: 'all 120ms ease' }}>
                {fmtDuration(h)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Computed window summary */}
      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-2)', border: '0.5px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCar size={18} stroke={1.75} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
              {startMode === 'now' ? 'Park now' : `${fmtDay(start)} · ${fmtClock(start)}`}
            </span>
            <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><IconArrowRight size={13} stroke={2} /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
              {endDate.getDate() !== start.getDate() ? `${fmtDay(endDate)} · ` : ''}{fmtClock(endDate)}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>
            Costs below are estimated for {fmtDuration(hours)} of parking
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}

function StepBtn({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} style={{ appearance: 'none', width: 36, height: 36, borderRadius: 10, flexShrink: 0, border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: disabled ? 'var(--text-3)' : 'var(--text-1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'all 120ms ease' }}>
      {children}
    </button>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
  background: 'var(--bg-2)', border: '0.5px solid var(--line-strong)', borderRadius: 11,
};
const inputStyle: CSSProperties = {
  flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent',
  color: 'var(--text-1)', fontFamily: 'var(--font-body)', fontSize: 14, padding: 0,
};
