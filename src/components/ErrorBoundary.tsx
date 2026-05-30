import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches render/runtime errors below it so a transient boot failure shows a
 * recoverable screen instead of a blank page. On the first crash we mirror the
 * user's own "it works after a refresh" workaround by reloading once
 * automatically (guarded by sessionStorage so we never loop). If it crashes
 * again after that reload, we stop auto-reloading and show a manual Retry.
 */

const RELOAD_GUARD = 'psg.eb.reloaded';

type Props = { children: ReactNode };
type State = { crashed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidMount() {
    // A clean mount means the previous load (if any) recovered — clear the
    // guard so a future, unrelated transient crash gets its one free reload.
    try {
      sessionStorage.removeItem(RELOAD_GUARD);
    } catch {
      /* ignore */
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD) === '1';
      if (!alreadyReloaded) sessionStorage.setItem(RELOAD_GUARD, '1');
    } catch {
      /* ignore */
    }
    if (!alreadyReloaded) window.location.reload();
  }

  private handleRetry = () => {
    try {
      sessionStorage.removeItem(RELOAD_GUARD);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#1a1a1a',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600 }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: '#6b6b6b', maxWidth: 280 }}>
          The app hit a snag loading. Try again — your saves are safe.
        </div>
        <button
          onClick={this.handleRetry}
          style={{
            marginTop: 4,
            padding: '10px 20px',
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            background: '#0a7d3c',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
