import { useTheme } from '../hooks/useTheme';
import { toggleDark } from '../lib/theme';
import { IconMoon, IconSun } from './icons';

/**
 * One-tap dark toggle for the app headers — the sun/moon button people
 * actually look for, rather than making them hunt through Account.
 *
 * It sets an explicit preference, so it overrides 'auto'. The full four-way
 * control (including getting back to Auto) lives in Account → Appearance.
 */
export function ThemeToggleButton({ size = 36 }: { size?: number }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleDark}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      data-track="theme_toggle"
      style={{
        appearance: 'none',
        width: size,
        height: size,
        borderRadius: 999,
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line-strong)',
        color: 'var(--text-2)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {isDark ? (
        <IconSun size={17} stroke={1.9} />
      ) : (
        <IconMoon size={17} stroke={1.9} />
      )}
    </button>
  );
}
