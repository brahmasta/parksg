/**
 * Editable rate-schedule grid, shared by the admin carpark editor and the
 * public "Suggest an edit" dialog. Generic over any row carrying the editable
 * fields (`EditableRate`); extra fields on the caller's row type (id, veh_cat,
 * source, …) ride along untouched through the spread in `setRate`.
 */
import type { Dispatch, SetStateAction } from 'react';
import {
  DAY_TYPES,
  RATE_SYSTEMS,
  toCents,
  toDollar,
  toIntOrNull,
  type EditableRate,
} from './rateGrid';

const cell: React.CSSProperties = {
  padding: '6px 7px',
  borderRadius: 8,
  border: '0.5px solid var(--line-strong)',
  background: 'var(--bg-2)',
  color: 'var(--text-1)',
  fontSize: 12.5,
  outline: 'none',
  width: '100%',
};
const addBtn: React.CSSProperties = {
  appearance: 'none', border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)',
  color: 'var(--accent)', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};

export function RateGridEditor<T extends EditableRate>({
  rates,
  setRates,
  makeBlank,
  note = 'Leave a field blank for “none”. Times in 24h HH:MM; blank = all day. Amounts in dollars.',
}: {
  rates: T[];
  setRates: Dispatch<SetStateAction<T[]>>;
  makeBlank: () => T;
  note?: string;
}) {
  const setRate = (i: number, patch: Partial<EditableRate>) =>
    setRates((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Rate schedule</div>
        <button type="button" onClick={() => setRates((prev) => [...prev, makeBlank()])} style={addBtn}>+ Add row</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '4px 4px', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--text-3)', textAlign: 'left' }}>
              {['Day', 'Start', 'End', '1st hr $', 'Block $', 'Block min', 'Entry $', 'Cap $', 'Grace', 'System', ''].map((h) => (
                <th key={h} style={{ padding: '2px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.map((r, i) => (
              <tr key={i}>
                <td><select style={{ ...cell, minWidth: 90 }} value={r.day_type} onChange={(e) => setRate(i, { day_type: e.target.value as EditableRate['day_type'] })}>{DAY_TYPES.map((d) => <option key={d}>{d}</option>)}</select></td>
                <td><input style={{ ...cell, width: 62 }} placeholder="HH:MM" value={r.start_time ?? ''} onChange={(e) => setRate(i, { start_time: e.target.value || null })} /></td>
                <td><input style={{ ...cell, width: 62 }} placeholder="HH:MM" value={r.end_time ?? ''} onChange={(e) => setRate(i, { end_time: e.target.value || null })} /></td>
                <td><input style={{ ...cell, width: 56 }} value={toDollar(r.first_hour_cents)} onChange={(e) => setRate(i, { first_hour_cents: toCents(e.target.value) })} /></td>
                <td><input style={{ ...cell, width: 56 }} value={toDollar(r.per_block_cents)} onChange={(e) => setRate(i, { per_block_cents: toCents(e.target.value) })} /></td>
                <td><input style={{ ...cell, width: 52 }} value={r.block_minutes ?? ''} onChange={(e) => setRate(i, { block_minutes: toIntOrNull(e.target.value) })} /></td>
                <td><input style={{ ...cell, width: 56 }} value={toDollar(r.per_entry_cents)} onChange={(e) => setRate(i, { per_entry_cents: toCents(e.target.value) })} /></td>
                <td><input style={{ ...cell, width: 56 }} value={toDollar(r.cap_cents)} onChange={(e) => setRate(i, { cap_cents: toCents(e.target.value) })} /></td>
                <td><input style={{ ...cell, width: 48 }} value={r.grace_minutes ?? ''} onChange={(e) => setRate(i, { grace_minutes: toIntOrNull(e.target.value) })} /></td>
                <td><select style={{ ...cell, minWidth: 90 }} value={r.system} onChange={(e) => setRate(i, { system: e.target.value })}>{RATE_SYSTEMS.map((s) => <option key={s}>{s}</option>)}</select></td>
                <td><button type="button" onClick={() => setRates((prev) => prev.filter((_, j) => j !== i))} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--bad)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button></td>
              </tr>
            ))}
            {rates.length === 0 && (
              <tr><td colSpan={11} style={{ color: 'var(--text-3)', padding: 10 }}>No rate rows yet — add one with “+ Add row”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}
