import type { ReactNode } from 'react';
import type { User } from '../lib/types';
import {
  IconBookmark,
  IconChevronRight,
  IconCloud,
  IconGoogleG,
  IconShield,
  IconSignOut,
  IconStar,
} from '../components/icons';

const APP_VERSION = 'v0.4.2';

/** Desktop Account — centered column, reached from the top-nav avatar. */
export function AccountDesktop({
  user,
  savedItemCount,
  onSignIn,
  onRequestSignOut,
  onOpenSaved,
}: {
  user: User | null;
  savedItemCount: number;
  onSignIn: () => void;
  onRequestSignOut: () => void;
  onOpenSaved: () => void;
}) {
  return (
    <div className="psg-screen" style={{ maxWidth: 640, margin: '0 auto', padding: '44px 28px 80px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, letterSpacing: -0.8, lineHeight: 1.1 }}>Account</h1>
      {user ? (
        <SignedIn user={user} savedCount={savedItemCount} onSignOut={onRequestSignOut} onOpenSaved={onOpenSaved} />
      ) : (
        <SignedOut onSignIn={onSignIn} />
      )}
    </div>
  );
}

function SignedIn({ user, savedCount, onSignOut, onOpenSaved }: { user: User; savedCount: number; onSignOut: () => void; onOpenSaved: () => void }) {
  return (
    <>
      <div style={{ marginTop: 22, background: 'var(--bg-1)', border: '0.5px solid var(--line)', borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ width: 56, height: 56, borderRadius: 15, background: 'var(--accent)', color: 'var(--accent-on)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: -0.3, flexShrink: 0 }}>{user.initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.2 }}>{user.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: 0.5, flexShrink: 0 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent)' }} /> SYNCED
        </span>
      </div>

      <Group label="Your saves">
        <Row icon={<IconBookmark filled size={16} />} title="Saved" sub={`${savedCount} item${savedCount === 1 ? '' : 's'} · destinations + carparks`} onClick={onOpenSaved} last />
      </Group>

      <Group label="Account">
        <Row icon={<IconCloud size={16} />} title="Sync across devices" sub="Last synced just now" detail="On" />
        <Row icon={<IconShield size={16} />} title="Privacy & data" sub="What we store, and how to export" last />
      </Group>

      <button onClick={onSignOut} style={{ appearance: 'none', border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--bad)', width: '100%', marginTop: 22, padding: '14px 16px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <IconSignOut size={16} stroke={2} /> Sign out
      </button>

      <div style={{ marginTop: 22, textAlign: 'center', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: 0.3 }}>
        wheretopark.sg · {APP_VERSION}
      </div>
    </>
  );
}

function SignedOut({ onSignIn }: { onSignIn: () => void }) {
  return (
    <>
      <div style={{ marginTop: 22, background: 'var(--bg-1)', border: '0.5px solid var(--line)', borderRadius: 20, padding: '32px 28px', textAlign: 'center' }}>
        <div style={{ margin: '0 auto 18px', width: 60, height: 60, borderRadius: 16, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconBookmark filled size={30} stroke={1.5} />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.5, lineHeight: 1.2 }}>Save carparks and destinations across devices</div>
        <p style={{ margin: '12px auto 0', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 360 }}>Sign in so your favourites and recent searches follow you between desktop, tablet and phone.</p>
        <button onClick={onSignIn} style={{ appearance: 'none', border: 0, width: '100%', maxWidth: 320, marginTop: 24, padding: '14px 18px', background: 'var(--text-1)', color: 'var(--bg-1)', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 14px rgba(14,16,20,0.10)' }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IconGoogleG size={16} /></span>
          Continue with Google
        </button>
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: 0.1 }}>By continuing you agree to our Terms and Privacy.</div>
      </div>

      <Group label="What you'll unlock">
        <Perk icon={<IconBookmark filled size={15} />} title="Saved carparks" sub="Bookmark a carpark from any results screen." />
        <Perk icon={<IconStar size={15} />} title="Saved destinations" sub="Name favourites like Office or Mum's place — one tap to search." />
        <Perk icon={<IconCloud size={15} />} title="Synced recents" sub="Recent searches follow you across every device." last />
      </Group>

      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
        <IconShield size={14} stroke={1.75} />
        <span>We store your saved carparks and destinations — never your location history or payment details.</span>
      </div>
    </>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 26 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      <div style={{ marginTop: 10, background: 'var(--bg-1)', border: '0.5px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Row({ icon, title, sub, detail, onClick, last }: { icon: ReactNode; title: string; sub?: string; detail?: string; onClick?: () => void; last?: boolean }) {
  const interactive = !!onClick;
  const common = {
    display: 'flex' as const, alignItems: 'center' as const, gap: 12, padding: '14px 16px',
    borderBottom: last ? 'none' : '0.5px solid var(--line)', color: 'var(--text-1)',
  };
  const inner = (
    <>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.35 }}>{sub}</div>}
      </div>
      {detail && <span style={{ fontSize: 12.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: 0.3, flexShrink: 0, marginRight: 4 }}>{detail}</span>}
      {interactive && <IconChevronRight size={15} stroke={2} style={{ color: 'var(--text-3)', flexShrink: 0 }} />}
    </>
  );
  return interactive ? (
    <button type="button" onClick={onClick} style={{ appearance: 'none', background: 'transparent', border: 0, width: '100%', textAlign: 'left', cursor: 'pointer', ...common }}>{inner}</button>
  ) : (
    <div style={common}>{inner}</div>
  );
}

function Perk({ icon, title, sub, last }: { icon: ReactNode; title: string; sub: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: last ? 'none' : '0.5px solid var(--line)' }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
      </div>
    </div>
  );
}
