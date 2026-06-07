import { formatDistance } from '../lib/availability';
import { IconWalk } from './icons';

export function WalkMap({
  walkMin,
  walkMeters,
  height = 180,
}: {
  walkMin: number;
  walkMeters: number;
  height?: number;
}) {
  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bg-2)',
        border: '0.5px solid var(--line)',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 358 180"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
        aria-hidden
      >
        <defs>
          <pattern id="psgGrid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0 H0 V22" fill="none" stroke="var(--line)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#psgGrid)" />
        {/* Stylized roads */}
        <path
          d="M-10 130 Q 80 110 200 138 T 380 120"
          stroke="var(--bg-3)"
          strokeWidth="14"
          fill="none"
        />
        <path
          d="M-10 130 Q 80 110 200 138 T 380 120"
          stroke="var(--line)"
          strokeWidth="0.5"
          fill="none"
          strokeDasharray="3 4"
        />
        <path
          d="M120 -10 Q 130 60 110 120 T 100 200"
          stroke="var(--bg-3)"
          strokeWidth="10"
          fill="none"
        />
        <path
          d="M260 -10 Q 250 40 260 100 T 270 200"
          stroke="var(--bg-3)"
          strokeWidth="10"
          fill="none"
        />

        {/* Dashed walking route */}
        <path
          d="M76 110 Q 140 60 220 50 T 296 36"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="2 5"
        />

        {/* Carpark pin (origin) */}
        <g transform="translate(76 110)">
          <circle r="13" fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="1.5" />
          <text
            textAnchor="middle"
            y="3.5"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600 }}
            fill="var(--accent)"
          >
            P
          </text>
        </g>
        {/* Destination pin */}
        <g transform="translate(296 36)">
          <circle r="6" fill="var(--text-1)" stroke="var(--bg-0)" strokeWidth="2" />
        </g>
      </svg>

      {/* Walk-time chip overlay */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 999,
          background: 'var(--glass)',
          border: '0.5px solid var(--line-strong)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: 'var(--text-1)',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <IconWalk size={13} stroke={2} />
        <span>{walkMin} min</span>
        <span style={{ opacity: 0.55 }}>·</span>
        <span style={{ opacity: 0.55 }}>{formatDistance(walkMeters)}</span>
      </div>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '6px 10px',
          borderRadius: 8,
          background: 'var(--glass)',
          border: '0.5px solid var(--line-strong)',
          fontSize: 10.5,
          fontFamily: 'var(--font-mono)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: 'var(--text-1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--accent)',
            }}
          />
          <span style={{ opacity: 0.68 }}>Carpark</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{ width: 6, height: 6, borderRadius: 999, background: '#F5F6F8' }}
          />
          <span style={{ opacity: 0.68 }}>Destination</span>
        </div>
      </div>
    </div>
  );
}
