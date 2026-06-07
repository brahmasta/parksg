import { useEffect, useState } from 'react';
import { adminFetch, AdminError, type CarparkLite, type CarparkFull, type RateRow } from './api';

const DAY_TYPES = ['WEEKDAY', 'SAT', 'SUN_PH'];
const SYSTEMS = ['EPS', 'COUPON', 'GANTRY_PRIVATE', 'FLAT'];

const field: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 10,
  border: '0.5px solid var(--line-strong)',
  background: 'var(--bg-2)',
  color: 'var(--text-1)',
  fontSize: 13.5,
  outline: 'none',
};
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
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, display: 'block' };

const toDollar = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));
const toCents = (s: string): number | null => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
};
const toIntOrNull = (s: string): number | null => {
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : null;
};
const blankRate = (): RateRow => ({
  day_type: 'WEEKDAY', start_time: null, end_time: null,
  first_hour_cents: null, per_block_cents: null, block_minutes: 30,
  per_entry_cents: null, cap_cents: null, grace_minutes: null,
  system: 'EPS', veh_cat: 'CAR', source: 'MANUAL', effective_from: null,
});

export function AdminCarparks({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CarparkLite[]>([]);
  const [selected, setSelected] = useState<CarparkFull | null>(null);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [centralArea, setCentralArea] = useState(false);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Debounced search. (Render gates on q length, so no need to clear results
  // synchronously here.)
  useEffect(() => {
    if (q.trim().length < 2) return;
    const h = setTimeout(() => {
      adminFetch<{ carparks: CarparkLite[] }>(`/api/admin/carparks?q=${encodeURIComponent(q.trim())}`, token)
        .then((d) => setResults(d.carparks))
        .catch((e: AdminError) => (e.status === 401 ? onAuthError() : setMsg(e.message)));
    }, 300);
    return () => clearTimeout(h);
  }, [q, token, onAuthError]);

  const open = async (id: string) => {
    setMsg(null);
    try {
      const d = await adminFetch<{ carpark: CarparkFull }>(`/api/admin/carparks?id=${encodeURIComponent(id)}`, token);
      const c = d.carpark;
      setSelected(c);
      setMeta({
        name: c.name ?? '',
        address: c.address ?? '',
        lat: c.lat == null ? '' : String(c.lat),
        lng: c.lng == null ? '' : String(c.lng),
        total_lots: c.total_lots == null ? '' : String(c.total_lots),
        car_park_type: c.car_park_type ?? '',
      });
      setCentralArea(!!c.central_area);
      setRates((c.rate_rows || []).map((r) => ({ ...r })));
    } catch (e) {
      if ((e as AdminError).status === 401) onAuthError();
      else setMsg((e as AdminError).message);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    try {
      await adminFetch(`/api/admin/carparks`, token, {
        method: 'POST',
        body: JSON.stringify({
          id: selected.id,
          meta: {
            name: meta.name,
            address: meta.address || null,
            lat: meta.lat === '' ? null : Number(meta.lat),
            lng: meta.lng === '' ? null : Number(meta.lng),
            total_lots: meta.total_lots === '' ? null : Number(meta.total_lots),
            central_area: centralArea,
            car_park_type: meta.car_park_type || null,
          },
          rates,
        }),
      });
      setMsg('Saved ✓');
      void open(selected.id);
    } catch (e) {
      if ((e as AdminError).status === 401) onAuthError();
      else setMsg((e as AdminError).message);
    } finally {
      setSaving(false);
    }
  };

  const setRate = (i: number, patch: Partial<RateRow>) =>
    setRates((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Carparks</h2>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, id, slug or address…"
        style={field}
      />

      {!selected && q.trim().length >= 2 && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => open(c.id)}
              style={{
                appearance: 'none', textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)',
                borderRadius: 12, padding: '11px 14px', color: 'var(--text-1)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {c.id.toUpperCase()} · {c.agency} · {c.total_lots ?? '—'} lots{c.address ? ` · ${c.address}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            type="button"
            onClick={() => { setSelected(null); setMsg(null); }}
            style={{ appearance: 'none', alignSelf: 'flex-start', background: 'transparent', border: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            ← Back to search
          </button>

          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {selected.id.toUpperCase()} · {selected.agency} · source {selected.source}
          </div>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Labeled label="Name"><input style={field} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Labeled>
            <Labeled label="Total lots"><input style={field} inputMode="numeric" value={meta.total_lots} onChange={(e) => setMeta({ ...meta, total_lots: e.target.value })} /></Labeled>
            <Labeled label="Address"><input style={field} value={meta.address} onChange={(e) => setMeta({ ...meta, address: e.target.value })} /></Labeled>
            <Labeled label="Latitude"><input style={field} inputMode="decimal" value={meta.lat} onChange={(e) => setMeta({ ...meta, lat: e.target.value })} /></Labeled>
            <Labeled label="Longitude"><input style={field} inputMode="decimal" value={meta.lng} onChange={(e) => setMeta({ ...meta, lng: e.target.value })} /></Labeled>
            <Labeled label="Car park type"><input style={field} value={meta.car_park_type} onChange={(e) => setMeta({ ...meta, car_park_type: e.target.value })} /></Labeled>
            <Labeled label="Central area">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-1)', height: 38 }}>
                <input type="checkbox" checked={centralArea} onChange={(e) => setCentralArea(e.target.checked)} /> Central area
              </label>
            </Labeled>
          </div>

          {/* Rates */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Rate schedule <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(saved as MANUAL)</span></div>
              <button type="button" onClick={() => setRates([...rates, blankRate()])} style={addBtn}>+ Add row</button>
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
                      <td><select style={{ ...cell, minWidth: 90 }} value={r.day_type} onChange={(e) => setRate(i, { day_type: e.target.value as RateRow['day_type'] })}>{DAY_TYPES.map((d) => <option key={d}>{d}</option>)}</select></td>
                      <td><input style={{ ...cell, width: 62 }} placeholder="HH:MM" value={r.start_time ?? ''} onChange={(e) => setRate(i, { start_time: e.target.value || null })} /></td>
                      <td><input style={{ ...cell, width: 62 }} placeholder="HH:MM" value={r.end_time ?? ''} onChange={(e) => setRate(i, { end_time: e.target.value || null })} /></td>
                      <td><input style={{ ...cell, width: 56 }} value={toDollar(r.first_hour_cents)} onChange={(e) => setRate(i, { first_hour_cents: toCents(e.target.value) })} /></td>
                      <td><input style={{ ...cell, width: 56 }} value={toDollar(r.per_block_cents)} onChange={(e) => setRate(i, { per_block_cents: toCents(e.target.value) })} /></td>
                      <td><input style={{ ...cell, width: 52 }} value={r.block_minutes ?? ''} onChange={(e) => setRate(i, { block_minutes: toIntOrNull(e.target.value) })} /></td>
                      <td><input style={{ ...cell, width: 56 }} value={toDollar(r.per_entry_cents)} onChange={(e) => setRate(i, { per_entry_cents: toCents(e.target.value) })} /></td>
                      <td><input style={{ ...cell, width: 56 }} value={toDollar(r.cap_cents)} onChange={(e) => setRate(i, { cap_cents: toCents(e.target.value) })} /></td>
                      <td><input style={{ ...cell, width: 48 }} value={r.grace_minutes ?? ''} onChange={(e) => setRate(i, { grace_minutes: toIntOrNull(e.target.value) })} /></td>
                      <td><select style={{ ...cell, minWidth: 90 }} value={r.system} onChange={(e) => setRate(i, { system: e.target.value })}>{SYSTEMS.map((s) => <option key={s}>{s}</option>)}</select></td>
                      <td><button type="button" onClick={() => setRates(rates.filter((_, j) => j !== i))} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--bad)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button></td>
                    </tr>
                  ))}
                  {rates.length === 0 && (
                    <tr><td colSpan={11} style={{ color: 'var(--text-3)', padding: 10 }}>No rate rows. Add one, or this carpark uses the operator fallback.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
              Saving replaces all of this carpark’s rate rows with the set above (marked MANUAL). Leave a field blank for “none”. Times in 24h HH:MM; blank = all day.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={save} disabled={saving} style={{ appearance: 'none', border: 0, padding: '12px 22px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-on)', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {msg && <span style={{ fontSize: 13, color: msg.includes('✓') ? 'var(--ok)' : 'var(--bad)' }}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Labeled({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={label}>{l}</span>
      {children}
    </div>
  );
}

const addBtn: React.CSSProperties = {
  appearance: 'none', border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)',
  color: 'var(--accent)', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};
