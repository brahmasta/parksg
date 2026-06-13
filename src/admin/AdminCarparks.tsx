import { useEffect, useState } from 'react';
import { adminFetch, AdminError, type CarparkLite, type CarparkFull, type RateRow } from './api';
import { RateGridEditor } from '../components/RateGridEditor';
import { OneMapSearch } from '../components/OneMapSearch';
import { LatLngPicker } from '../components/LatLngPicker';

const SYSTEMS = ['EPS', 'COUPON', 'GANTRY_PRIVATE', 'FLAT'];
const AGENCIES = ['OPERATOR', 'HDB', 'URA', 'LTA', 'JTC', 'NPARKS'];

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
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, display: 'block' };

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
  const [creating, setCreating] = useState(false);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [newCp, setNewCp] = useState<Record<string, string>>({});
  const [centralArea, setCentralArea] = useState(false);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const startCreate = () => {
    setSelected(null);
    setMsg(null);
    setCentralArea(false);
    setRates([]);
    setNewCp({
      name: '', id: '', agency: 'OPERATOR', source_code: '', address: '',
      lat: '', lng: '', total_lots: '', car_park_type: '', parking_system: '',
    });
    setCreating(true);
  };

  const create = async () => {
    if (!newCp.name.trim()) { setMsg('Name is required.'); return; }
    setSaving(true);
    setMsg(null);
    try {
      const res = await adminFetch<{ ok: boolean; id: string; warning?: string }>(`/api/admin/carparks`, token, {
        method: 'PUT',
        body: JSON.stringify({
          meta: {
            name: newCp.name,
            id: newCp.id.trim() || undefined,
            agency: newCp.agency,
            source_code: newCp.source_code.trim() || undefined,
            address: newCp.address || null,
            lat: newCp.lat === '' ? null : Number(newCp.lat),
            lng: newCp.lng === '' ? null : Number(newCp.lng),
            total_lots: newCp.total_lots === '' ? null : Number(newCp.total_lots),
            central_area: centralArea,
            car_park_type: newCp.car_park_type || null,
            parking_system: newCp.parking_system || undefined,
          },
          rates,
        }),
      });
      setCreating(false);
      void open(res.id);
      if (res.warning) setMsg(res.warning);
    } catch (e) {
      if ((e as AdminError).status === 401) onAuthError();
      else setMsg((e as AdminError).message);
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Carparks</h2>
        {!selected && !creating && (
          <button
            type="button"
            onClick={startCreate}
            style={{ appearance: 'none', border: 0, padding: '9px 16px', borderRadius: 10, background: 'var(--accent)', color: 'var(--accent-on)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            + New carpark
          </button>
        )}
      </div>

      {!selected && !creating && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, id, slug or address…"
          style={field}
        />
      )}

      {!selected && !creating && q.trim().length >= 2 && results.length > 0 && (
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

      {creating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            type="button"
            onClick={() => { setCreating(false); setMsg(null); }}
            style={{ appearance: 'none', alignSelf: 'flex-start', background: 'transparent', border: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            ← Back to search
          </button>

          <div style={{ fontSize: 13, fontWeight: 700 }}>
            New carpark <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>(saved as MANUAL)</span>
          </div>

          {/* Location: search OneMap or drop a pin — both fill lat/lng below. */}
          <div>
            <OneMapSearch
              onSelect={(p) =>
                setNewCp((prev) => ({
                  ...prev,
                  name: prev.name?.trim() ? prev.name : p.name,
                  address: p.address || prev.address,
                  lat: String(p.lat),
                  lng: String(p.lng),
                }))
              }
            />
            <div style={{ marginTop: 10 }}>
              <LatLngPicker
                lat={newCp.lat !== '' && Number.isFinite(Number(newCp.lat)) ? Number(newCp.lat) : null}
                lng={newCp.lng !== '' && Number.isFinite(Number(newCp.lng)) ? Number(newCp.lng) : null}
                onChange={(la, ln) => setNewCp((prev) => ({ ...prev, lat: String(la), lng: String(ln) }))}
                height={240}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Labeled label="Name *"><input style={field} value={newCp.name} onChange={(e) => setNewCp({ ...newCp, name: e.target.value })} placeholder="e.g. Marina Square" /></Labeled>
            <Labeled label="Agency">
              <select style={field} value={newCp.agency} onChange={(e) => setNewCp({ ...newCp, agency: e.target.value })}>
                {AGENCIES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Labeled>
            <Labeled label="ID (optional)"><input style={field} value={newCp.id} onChange={(e) => setNewCp({ ...newCp, id: e.target.value })} placeholder="auto: MANUAL:<slug of name>" /></Labeled>
            <Labeled label="Source code (optional)"><input style={field} value={newCp.source_code} onChange={(e) => setNewCp({ ...newCp, source_code: e.target.value })} placeholder="auto: slug of name" /></Labeled>
            <Labeled label="Total lots"><input style={field} inputMode="numeric" value={newCp.total_lots} onChange={(e) => setNewCp({ ...newCp, total_lots: e.target.value })} /></Labeled>
            <Labeled label="Address"><input style={field} value={newCp.address} onChange={(e) => setNewCp({ ...newCp, address: e.target.value })} /></Labeled>
            <Labeled label="Latitude"><input style={field} inputMode="decimal" value={newCp.lat} onChange={(e) => setNewCp({ ...newCp, lat: e.target.value })} /></Labeled>
            <Labeled label="Longitude"><input style={field} inputMode="decimal" value={newCp.lng} onChange={(e) => setNewCp({ ...newCp, lng: e.target.value })} /></Labeled>
            <Labeled label="Car park type"><input style={field} value={newCp.car_park_type} onChange={(e) => setNewCp({ ...newCp, car_park_type: e.target.value })} placeholder="e.g. SURFACE / MULTISTOREY" /></Labeled>
            <Labeled label="Parking system">
              <select style={field} value={newCp.parking_system} onChange={(e) => setNewCp({ ...newCp, parking_system: e.target.value })}>
                <option value="">—</option>
                {SYSTEMS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Labeled>
            <Labeled label="Central area">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--text-1)', height: 38 }}>
                <input type="checkbox" checked={centralArea} onChange={(e) => setCentralArea(e.target.checked)} /> Central area
              </label>
            </Labeled>
          </div>

          <RateGridEditor
            rates={rates}
            setRates={setRates}
            makeBlank={blankRate}
            note="Saving replaces all of this carpark’s rate rows (marked MANUAL). Leave a field blank for “none”. Times in 24h HH:MM; blank = all day."
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={create} disabled={saving} style={{ appearance: 'none', border: 0, padding: '12px 22px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-on)', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating…' : 'Create carpark'}
            </button>
            {msg && <span style={{ fontSize: 13, color: msg.includes('✓') ? 'var(--ok)' : 'var(--bad)' }}>{msg}</span>}
          </div>
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
          <RateGridEditor
            rates={rates}
            setRates={setRates}
            makeBlank={blankRate}
            note="Saving replaces all of this carpark’s rate rows (marked MANUAL). Leave a field blank for “none”. Times in 24h HH:MM; blank = all day."
          />

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

/** The MANUAL rate-schedule grid, shared by the create + edit views. */
function Labeled({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={label}>{l}</span>
      {children}
    </div>
  );
}
