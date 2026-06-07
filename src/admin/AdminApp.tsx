import { useState } from 'react';
import { useSession } from '../lib/auth';
import { Wordmark } from '../components/atoms';
import { AdminDashboard } from './AdminDashboard';
import { AdminCarparks } from './AdminCarparks';
import { AdminFeedback } from './AdminFeedback';

type Tab = 'dashboard' | 'carparks' | 'feedback';
const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'carparks', label: 'Carparks' },
  { key: 'feedback', label: 'Feedback' },
];

export function AdminApp() {
  const { user, accessToken, signIn, signOut, error } = useSession();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (!accessToken) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', padding: 20 }}>
        <div style={{ width: 'min(400px, 100%)', background: 'var(--bg-1)', border: '0.5px solid var(--line-strong)', borderRadius: 18, padding: 28, boxShadow: 'var(--shadow-card)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', marginBottom: 18 }}><Wordmark size={20} /></div>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Admin control panel</h1>
          <p style={{ margin: '0 0 22px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {user ? 'Re-authenticate to continue.' : 'Sign in with the admin Google account.'}
          </p>
          <button
            type="button"
            onClick={signIn}
            style={{ appearance: 'none', border: 0, width: '100%', padding: '13px 18px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-on)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Continue with Google
          </button>
          {error && <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--bad)' }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="psg" style={{ minHeight: '100dvh', background: 'var(--bg-0)', color: 'var(--text-1)', fontFamily: 'var(--font-body)' }}>
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '0 20px', height: 60,
          background: 'color-mix(in srgb, var(--bg-0) 88%, transparent)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '0.5px solid var(--line-strong)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <Wordmark size={17} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Admin</span>
          <nav style={{ display: 'flex', gap: 4 }}>
            {TABS.map((tt) => (
              <button
                key={tt.key}
                type="button"
                onClick={() => setTab(tt.key)}
                style={{
                  appearance: 'none', border: 0, cursor: 'pointer',
                  padding: '7px 13px', borderRadius: 9, fontSize: 13.5,
                  fontWeight: tab === tt.key ? 600 : 500,
                  background: tab === tt.key ? 'var(--bg-1)' : 'transparent',
                  boxShadow: tab === tt.key ? 'inset 0 0 0 0.5px var(--line-strong)' : undefined,
                  color: tab === tt.key ? 'var(--text-1)' : 'var(--text-2)',
                }}
              >
                {tt.label}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{user?.email}</span>
          <button type="button" onClick={signOut} style={{ appearance: 'none', border: '0.5px solid var(--line-strong)', background: 'var(--bg-1)', color: 'var(--text-2)', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px 80px' }}>
        {tab === 'dashboard' && <AdminDashboard token={accessToken} onAuthError={signOut} />}
        {tab === 'carparks' && <AdminCarparks token={accessToken} onAuthError={signOut} />}
        {tab === 'feedback' && <AdminFeedback token={accessToken} onAuthError={signOut} />}
      </main>
    </div>
  );
}
