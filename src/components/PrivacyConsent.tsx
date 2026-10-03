import { privacyPolicyUrl } from '../lib/privacy';

/** The tick-box people must check before any sign-in button works. */
export function PrivacyConsent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 18,
        textAlign: 'left',
        fontSize: 13,
        lineHeight: 1.45,
        color: 'var(--text-2)',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-track="privacy_consent"
        style={{ width: 18, height: 18, margin: '1px 0 0', accentColor: 'var(--accent)', flexShrink: 0 }}
      />
      <span>
        I have read and agree to the{' '}
        <a
          href={privacyPolicyUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', fontWeight: 600 }}
        >
          Privacy Policy
        </a>
        .
      </span>
    </label>
  );
}
