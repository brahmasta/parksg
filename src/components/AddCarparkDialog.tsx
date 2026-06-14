import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from './BottomSheet';
import { IconCheck, IconClose, IconInfo } from './icons';
import { PlaceSearch } from './PlaceSearch';
import { LatLngPicker } from './LatLngPicker';
import { RateGridEditor } from './RateGridEditor';
import { blankEditableRate, type EditableRate } from './rateGrid';
import { submitNewCarpark } from '../lib/api/carparkEdit';
import type { User } from '../lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: 'sheet' | 'modal';
  user?: User | null;
};

export function AddCarparkDialog({ open, onClose, variant = 'sheet', user = null }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [totalLots, setTotalLots] = useState('');
  const [rates, setRates] = useState<EditableRate[]>([]);
  const [note, setNote] = useState('');
  const [contactName, setContactName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const missingName = touched && !name.trim();
  const missingLoc = touched && (lat == null || lng == null);
  const missingEmail = !user && touched && !email.trim();

  const submit = async () => {
    setTouched(true);
    if (!name.trim() || lat == null || lng == null || (!user && !email.trim())) return;
    setStatus('submitting');
    const ok = await submitNewCarpark({
      name: name.trim(),
      lat,
      lng,
      address: address.trim() || null,
      totalLots: totalLots.trim() === '' ? null : Math.round(Number(totalLots)) || null,
      rates,
      note: note.trim() || null,
      userId: user?.id ?? null,
      email: (user?.email ?? email).trim() || null,
      contactName: (user?.name ?? contactName).trim() || null,
    });
    setStatus(ok ? 'success' : 'error');
    if (ok) window.setTimeout(onClose, 1600);
  };

  const body =
    status === 'success' ? (
      <div style={{ padding: '28px 22px 34px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--accent-tint, rgba(46,227,194,0.16))', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={26} stroke={2.5} />
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>Sent for review</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 300, lineHeight: 1.45 }}>
          Thanks — an admin will review this carpark before it&rsquo;s added to wheretopark.sg.
        </div>
      </div>
    ) : (
      <div className="psg-rich" style={{ padding: '4px 20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.3 }}>
            Add a carpark
          </span>
          {variant === 'modal' && (
            <button type="button" aria-label="Close" onClick={onClose} style={iconBtnStyle}>
              <IconClose size={15} stroke={2} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 10, border: '0.5px solid var(--line)' }}>
          <span style={{ color: 'var(--warn, #A66B00)', display: 'inline-flex', flexShrink: 0, marginTop: 1 }}>
            <IconInfo size={15} stroke={2} />
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Search for the place or drop a pin on the map to set the location. An admin reviews every new carpark before it goes live.
          </span>
        </div>

        <Label htmlFor="ac-search">Find the location</Label>
        <PlaceSearch
          placeholder="Search a building or address…"
          onSelect={(p) => {
            if (!name.trim()) setName(p.name);
            setAddress(p.address);
            setLat(p.lat);
            setLng(p.lng);
          }}
        />
        <div style={{ marginTop: 10 }}>
          <LatLngPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} height={240} />
        </div>
        <div style={{ fontSize: 12, color: missingLoc ? 'var(--bad, #C0392B)' : 'var(--text-3)', marginTop: 6 }}>
          {lat != null && lng != null
            ? `Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : 'Tap the map or pick a search result to drop a pin.'}
        </div>

        <Label htmlFor="ac-name">Carpark name</Label>
        <input
          id="ac-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marina Square Car Park"
          style={{ ...fieldStyle, borderColor: missingName ? 'var(--bad, #C0392B)' : 'var(--line-strong)' }}
        />
        {missingName && <ErrorText>Please give the carpark a name.</ErrorText>}

        <Label htmlFor="ac-address">Address (optional)</Label>
        <input id="ac-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street / building address" style={fieldStyle} />

        <Label htmlFor="ac-lots">Total lots (optional)</Label>
        <input id="ac-lots" inputMode="numeric" value={totalLots} onChange={(e) => setTotalLots(e.target.value.replace(/[^0-9]/g, ''))} placeholder="If you know it" style={fieldStyle} />

        <div style={{ margin: '16px 0 4px' }}>
          <RateGridEditor rates={rates} setRates={setRates} makeBlank={blankEditableRate} note="Optional — add the rate schedule if you know it. Amounts in dollars; times 24h HH:MM." />
        </div>

        <Label htmlFor="ac-note">Note for the reviewer (optional)</Label>
        <textarea id="ac-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that helps verify this carpark…" rows={2} style={{ ...fieldStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }} />

        {user ? (
          <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-3)' }}>
            Submitting as <strong style={{ color: 'var(--text-2)' }}>{user.name || user.email}</strong>
            {user.name ? ` (${user.email})` : ''}
          </div>
        ) : (
          <>
            <Label htmlFor="ac-cname">Your name (optional)</Label>
            <input id="ac-cname" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" style={fieldStyle} />
            <Label htmlFor="ac-email">Your email</Label>
            <input id="ac-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ ...fieldStyle, borderColor: missingEmail ? 'var(--bad, #C0392B)' : 'var(--line-strong)' }} />
            {missingEmail && <ErrorText>Please leave an email so we can follow up.</ErrorText>}
          </>
        )}

        {status === 'error' && <ErrorText>Couldn&rsquo;t submit — please check your connection and try again.</ErrorText>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={status === 'submitting'} style={{ appearance: 'none', flex: '0 0 auto', padding: '12px 18px', borderRadius: 12, border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600, cursor: status === 'submitting' ? 'default' : 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={status === 'submitting'} style={{ appearance: 'none', flex: 1, padding: '12px 18px', borderRadius: 12, border: 0, background: 'var(--accent)', color: 'var(--accent-on)', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, cursor: status === 'submitting' ? 'wait' : 'pointer', opacity: status === 'submitting' ? 0.7 : 1 }}>
            {status === 'submitting' ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </div>
    );

  if (variant === 'modal') {
    if (!open || typeof document === 'undefined') return null;
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label="Add a carpark" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(14,16,20,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
        <div className="psg-screen" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', background: 'var(--bg-0)', border: '0.5px solid var(--line-strong)', borderRadius: 20, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' }}>
          {body}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      {body}
    </BottomSheet>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 12,
  border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)',
  color: 'var(--text-1)', fontSize: 14, outline: 'none',
};
const iconBtnStyle: React.CSSProperties = {
  appearance: 'none', width: 32, height: 32, borderRadius: 999,
  border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--text-2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
};

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '12px 0 6px' }}>
      {children}
    </label>
  );
}
function ErrorText({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--bad, #C0392B)', marginTop: 6 }}>{children}</div>;
}
