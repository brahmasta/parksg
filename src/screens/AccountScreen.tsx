import type { ReactNode } from 'react';
import type { User } from '../lib/types';
import {
  IconBookmark,
  IconChevronLeft,
  IconChevronRight,
  IconCloud,
  IconGoogleG,
  IconShield,
  IconSignOut,
  IconStar,
} from '../components/icons';

const APP_VERSION = 'v0.4.2';

export function AccountScreen({
  user,
  savedCarparksCount,
  savedDestCount,
  onBack,
  onSignIn,
  onOpenSavedCarparks,
  onOpenSavedDestinations,
  onRequestSignOut,
}: {
  user: User | null;
  savedCarparksCount: number;
  savedDestCount: number;
  onBack: () => void;
  onSignIn: () => void;
  onOpenSavedCarparks: () => void;
  onOpenSavedDestinations: () => void;
  onRequestSignOut: () => void;
}) {
  return (
    <div
      className="psg-screen"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TopBar onBack={onBack} title="Account" />
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 24px' }}>
        {user ? (
          <SignedInBody
            user={user}
            savedCarparksCount={savedCarparksCount}
            savedDestCount={savedDestCount}
            onOpenSavedCarparks={onOpenSavedCarparks}
            onOpenSavedDestinations={onOpenSavedDestinations}
            onRequestSignOut={onRequestSignOut}
          />
        ) : (
          <SignedOutBody onSignIn={onSignIn} />
        )}
      </div>
    </div>
  );
}

function TopBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div
      style={{
        padding: '52px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
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
          flexShrink: 0,
        }}
      >
        <IconChevronLeft size={18} stroke={2} />
      </button>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: -0.4,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
    </div>
  );
}

function SignedOutBody({ onSignIn }: { onSignIn: () => void }) {
  return (
    <>
      <div
        style={{
          background: 'var(--bg-1)',
          border: '0.5px solid var(--line)',
          borderRadius: 18,
          padding: '24px 20px 22px',
          textAlign: 'center',
          marginTop: 4,
        }}
      >
        <div
          style={{
            margin: '0 auto 16px',
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--accent-tint)',
            color: 'var(--accent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBookmark filled size={28} stroke={1.5} />
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.4,
            lineHeight: 1.2,
          }}
        >
          Save carparks and<br />destinations across devices
        </div>
        <p
          style={{
            margin: '10px auto 0',
            fontSize: 13.5,
            color: 'var(--text-2)',
            lineHeight: 1.5,
            maxWidth: 280,
            textWrap: 'pretty',
          }}
        >
          Sign in so your favourites and recent searches follow you between
          iPhone and the web.
        </p>

        <button
          type="button"
          onClick={onSignIn}
          style={{
            appearance: 'none',
            border: 0,
            width: '100%',
            marginTop: 22,
            padding: '14px 18px',
            background: 'var(--text-1)',
            color: 'var(--bg-1)',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: -0.1,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            boxShadow: '0 6px 14px rgba(14,16,20,0.10)',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconGoogleG size={16} />
          </span>
          Continue with Google
        </button>

        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            color: 'var(--text-3)',
            lineHeight: 1.5,
            fontFamily: 'var(--font-mono)',
            letterSpacing: 0.1,
          }}
        >
          By continuing you agree to our Terms and Privacy.
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <MonoLabel>What you'll unlock</MonoLabel>
        <div
          style={{
            marginTop: 10,
            background: 'var(--bg-1)',
            border: '0.5px solid var(--line)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <PerkRow
            icon={<IconBookmark filled size={15} />}
            title="Saved carparks"
            sub="Bookmark a carpark from any results screen."
          />
          <PerkRow
            icon={<IconStar size={15} />}
            title="Saved destinations"
            sub="Name favourites like Office or Mum's place — one tap to search."
          />
          <PerkRow
            icon={<IconCloud size={15} />}
            title="Synced recents"
            sub="Recent searches follow you across iPhone and web."
            last
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11.5,
          color: 'var(--text-3)',
          lineHeight: 1.5,
        }}
      >
        <IconShield size={13} stroke={1.75} />
        <span>
          We store your saved carparks and destinations — never your location
          history or payment details.
        </span>
      </div>
    </>
  );
}

function SignedInBody({
  user,
  savedCarparksCount,
  savedDestCount,
  onOpenSavedCarparks,
  onOpenSavedDestinations,
  onRequestSignOut,
}: {
  user: { name: string; email: string; initials: string };
  savedCarparksCount: number;
  savedDestCount: number;
  onOpenSavedCarparks: () => void;
  onOpenSavedDestinations: () => void;
  onRequestSignOut: () => void;
}) {
  return (
    <>
      <div
        style={{
          background: 'var(--bg-1)',
          border: '0.5px solid var(--line)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 4,
        }}
      >
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'var(--accent)',
            color: 'var(--accent-on)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: -0.3,
            flexShrink: 0,
          }}
        >
          {user.initials}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--text-1)',
              letterSpacing: -0.2,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.name}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--text-3)',
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.email}
          </div>
        </div>
        <span
          aria-label="Account synced"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 999,
            background: 'var(--accent-tint)',
            color: 'var(--accent)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: 'var(--accent)',
            }}
          />
          SYNCED
        </span>
      </div>

      <div style={{ marginTop: 22 }}>
        <MonoLabel>Your saves</MonoLabel>
        <div
          style={{
            marginTop: 10,
            background: 'var(--bg-1)',
            border: '0.5px solid var(--line)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <NavRow
            icon={<IconBookmark filled size={16} />}
            title="Saved carparks"
            sub={
              savedCarparksCount === 0
                ? 'Bookmark a carpark from any results page'
                : `${savedCarparksCount} carpark${
                    savedCarparksCount === 1 ? '' : 's'
                  }`
            }
            onClick={onOpenSavedCarparks}
          />
          <NavRow
            icon={<IconStar size={16} />}
            title="Saved destinations"
            sub={
              savedDestCount === 0
                ? 'Add named favourites for one-tap search'
                : `${savedDestCount} destination${
                    savedDestCount === 1 ? '' : 's'
                  }`
            }
            onClick={onOpenSavedDestinations}
            last
          />
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <MonoLabel>Account</MonoLabel>
        <div
          style={{
            marginTop: 10,
            background: 'var(--bg-1)',
            border: '0.5px solid var(--line)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <NavRow
            icon={<IconCloud size={16} />}
            title="Sync across devices"
            sub="Last synced just now"
            detail="On"
          />
          <NavRow
            icon={<IconShield size={16} />}
            title="Privacy & data"
            sub="What we store, and how to export"
            last
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onRequestSignOut}
        style={{
          appearance: 'none',
          border: '0.5px solid var(--line-strong)',
          background: 'var(--bg-1)',
          color: 'var(--bad)',
          width: '100%',
          marginTop: 22,
          padding: '14px 16px',
          borderRadius: 14,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        <IconSignOut size={16} stroke={2} />
        Sign out
      </button>

      <div
        style={{
          marginTop: 22,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: 0.3,
        }}
      >
        wheretopark.sg · {APP_VERSION}
      </div>
    </>
  );
}

function PerkRow({
  icon,
  title,
  sub,
  last,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 14px',
        borderBottom: last ? 'none' : '0.5px solid var(--line)',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          background: 'var(--accent-tint)',
          color: 'var(--accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.1,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-2)',
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function NavRow({
  icon,
  title,
  sub,
  detail,
  onClick,
  last,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  detail?: string;
  onClick?: () => void;
  last?: boolean;
}) {
  const interactive = !!onClick;
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      type={interactive ? 'button' : undefined}
      style={{
        appearance: 'none',
        background: 'transparent',
        border: 0,
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 14px',
        borderBottom: last ? 'none' : '0.5px solid var(--line)',
        color: 'var(--text-1)',
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--bg-3)',
          color: 'var(--text-2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: -0.1,
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-3)',
              marginTop: 2,
              lineHeight: 1.35,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {detail && (
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: 0.3,
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          {detail}
        </span>
      )}
      {interactive && (
        <IconChevronRight
          size={14}
          stroke={2}
          style={{ color: 'var(--text-3)', flexShrink: 0 }}
        />
      )}
    </Tag>
  );
}

function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        color: 'var(--text-3)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}
