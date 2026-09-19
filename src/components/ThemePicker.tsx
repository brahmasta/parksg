import type { CSSProperties } from 'react';
import { useTheme } from '../hooks/useTheme';
import { THEME_OPTIONS, type ThemePref } from '../lib/theme';
import { IconContrast, IconDevice, IconMoon, IconSun } from './icons';

export function ThemeIcon({
  pref,
  size = 18,
  stroke = 1.9,
}: {
  pref: ThemePref;
  size?: number;
  stroke?: number;
}) {
  if (pref === 'auto') return <IconDevice size={size} stroke={stroke} />;
  if (pref === 'dark') return <IconMoon size={size} stroke={stroke} />;
  if (pref === 'light') return <IconSun size={size} stroke={stroke} />;
  return <IconContrast size={size} stroke={stroke} />;
}

const optionBase: CSSProperties = {
  appearance: 'none',
  minWidth: 0,
  // ≥44px tall: the one control most likely to be tapped outdoors.
  padding: '12px 6px',
  borderRadius: 11,
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  letterSpacing: -0.1,
};

/**
 * Four-way theme control: Auto (the default, follows the device), Sunlight,
 * Standard, Dark.
 *
 * A radiogroup of real <button>s rather than a switch, because the choice is
 * not binary — a driver picks the one that suits the light they are in, and
 * Auto is a distinct answer from any of the three palettes.
 *
 * Lays out 2×2 on a phone and 4-across from 520px; see .psg-theme-options.
 */
export function ThemePicker() {
  const { pref, setPref } = useTheme();
  const active = THEME_OPTIONS.find((o) => o.id === pref);

  return (
    <div>
      <div className="psg-theme-options" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map(({ id, label }) => {
          const selected = pref === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-track={`theme_${id}`}
              onClick={() => setPref(id)}
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
              <ThemeIcon pref={id} />
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
