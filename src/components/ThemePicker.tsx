import type { CSSProperties } from 'react';
import { useTheme } from '../hooks/useTheme';
import { THEMES, type Theme } from '../lib/theme';
import { IconContrast, IconMoon, IconSun } from './icons';

function ThemeIcon({ theme, size = 18 }: { theme: Theme; size?: number }) {
  if (theme === 'dark') return <IconMoon size={size} stroke={1.9} />;
  if (theme === 'light') return <IconSun size={size} stroke={1.9} />;
  return <IconContrast size={size} stroke={1.9} />;
}

const optionBase: CSSProperties = {
  appearance: 'none',
  flex: 1,
  minWidth: 0,
  // ≥44px tall: these are the one control most likely to be tapped outdoors.
  padding: '12px 8px',
  borderRadius: 11,
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  letterSpacing: -0.1,
};

/**
 * Three-way theme control: Sunlight (the default), Standard, Dark.
 *
 * A radiogroup of real <button>s rather than a switch, because the choice is
 * not binary — a driver wants to pick the one that suits the light they are
 * actually in, not toggle "dark on/off".
 */
export function ThemePicker() {
  const [theme, setTheme] = useTheme();
  const active = THEMES.find((t) => t.id === theme);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Theme"
        style={{ display: 'flex', gap: 8 }}
      >
        {THEMES.map(({ id, label }) => {
          const selected = theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-track={`theme_${id}`}
              onClick={() => setTheme(id)}
              style={{
                ...optionBase,
                background: selected ? 'var(--accent-tint)' : 'var(--bg-2)',
                border: selected
                  ? '1.5px solid var(--accent)'
                  : '1px solid var(--line-strong)',
                color: selected ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: selected ? 700 : 500,
              }}
            >
              <ThemeIcon theme={id} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <p
          style={{
            margin: '10px 2px 0',
            fontSize: 12.5,
            lineHeight: 1.45,
            color: 'var(--text-2)',
          }}
        >
          {active.blurb}
        </p>
      )}
    </div>
  );
}
