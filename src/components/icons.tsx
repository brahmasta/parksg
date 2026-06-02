import type { CSSProperties, ReactNode } from 'react';

type IconProps = {
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
};

type WithChildren = IconProps & { children: ReactNode };

const Icon = ({ size = 20, stroke = 1.75, children, ...rest }: WithChildren) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...rest}
  >
    {children}
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const IconLocation = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="8" />
  </Icon>
);
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const IconWalk = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="13" cy="4" r="1.6" />
    <path d="m13 21-1.5-6-3-2.5L10 8l4 3 3 1.5" />
    <path d="M9.5 13.5 7 17l-2 3" />
  </Icon>
);
export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);
export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const IconMap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </Icon>
);
export const IconList = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="3.5" cy="6" r="1" />
    <circle cx="3.5" cy="12" r="1" />
    <circle cx="3.5" cy="18" r="1" />
  </Icon>
);
export const IconNavigate = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11 21 3l-8 18-2-8-8-2Z" />
  </Icon>
);
export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </Icon>
);
export const IconMinus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);
export const IconCar = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 13l1.8-5.2A2 2 0 0 1 6.7 6.4h10.6a2 2 0 0 1 1.9 1.4L21 13v5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H6.5v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M3 13h18" />
    <circle cx="7" cy="16" r="0.6" />
    <circle cx="17" cy="16" r="0.6" />
  </Icon>
);
export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Icon>
);
export const IconDatabase = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </Icon>
);
export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="m3 13 9 5 9-5M3 18l9 5 9-5" />
  </Icon>
);
export const IconExternal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);
export const IconWarning = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17.5v.5" />
  </Icon>
);
export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </Icon>
);
export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" />
    <circle cx="12" cy="9" r="2.5" />
  </Icon>
);
export const IconHistory = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 8v4l3 2" />
  </Icon>
);
export const IconBolt = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </Icon>
);
export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.6" />
  </Icon>
);

// ── Accounts & Save ─────────────────────────────────────────────────
export const IconBookmark = ({
  filled,
  ...p
}: IconProps & { filled?: boolean }) => (
  <svg
    width={p.size ?? 20}
    height={p.size ?? 20}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={p.stroke ?? 1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={p.className}
    style={p.style}
  >
    <path d="M6 3h12v18l-6-4.2L6 21V3Z" />
  </svg>
);
export const IconUser = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);
export const IconSignOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="M10 8l-4 4 4 4" />
    <path d="M6 12h12" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
);
export const IconCloud = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 18h11a4 4 0 0 0 .5-7.96 6 6 0 0 0-11.5-1A4 4 0 0 0 7 18Z" />
  </Icon>
);
export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6l-8-3Z" />
  </Icon>
);
export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
  </Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconStar = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 2.7 5.8 6.3.9-4.5 4.4 1 6.4-5.5-3-5.5 3 1-6.4-4.5-4.4 6.3-.9L12 3Z" />
  </Icon>
);
export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-5h4v5" />
  </Icon>
);
export const IconBriefcase = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M3 13h18" />
  </Icon>
);
export const IconHeart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-7-4.6-9.3-9.2A5.3 5.3 0 0 1 12 5.5a5.3 5.3 0 0 1 9.3 6.3C19 16.4 12 21 12 21Z" />
  </Icon>
);
export const IconBuilding = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
  </Icon>
);

// iOS share glyph — box with an arrow rising out of the top. Used in the
// PWA install instructions on iOS Safari.
export const IconShare = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v12" />
    <path d="m8 8 4-4 4 4" />
    <path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" />
  </Icon>
);

// Google's "G" — uses brand colors directly (not in the design system).
export const IconGoogleG = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#EA4335"
      d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5Z"
    />
    <path
      fill="#4285F4"
      d="M46.5 24.5c0-1.7-.2-3.3-.4-4.9H24v9.3h12.7c-.6 3-2.3 5.6-4.8 7.3l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5Z"
    />
    <path
      fill="#FBBC05"
      d="M10.4 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.7l7.8-6.1Z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.5 0 11.9-2.1 15.9-5.9l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48Z"
    />
  </svg>
);

/* ── Maps-provider app icons (used by the Navigate picker) ─────────────────
   Brand app-icon tiles. Google Maps = official multi-colour pin on a white
   tile; Waze = official brand mark (white) on its cyan tile; Apple Maps = a
   faithful map-scene tile (no open-licence Apple Maps SVG exists). */
export const IconGoogleMaps = ({ size = 38 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 38 38" aria-hidden>
    <rect width="38" height="38" rx="9" fill="#fff" stroke="#E4E3DF" strokeWidth="0.5" />
    <g transform="translate(10.55 6.9) scale(0.066)">
      <path fill="#34A853" d="M70.5853976,271.865254 C81.1995596,285.391378 90.8598594,299.639537 99.4963338,314.50654 C106.870174,328.489419 109.94381,337.97007 115.333495,354.817346 C118.638014,364.124835 121.625069,366.902652 128.046515,366.902652 C135.045169,366.902652 138.219816,362.176756 140.672953,354.867852 C145.766819,338.95854 149.763988,326.815514 156.069992,315.343493 C168.443902,293.193112 183.819296,273.510299 198.927732,254.592287 C203.018698,249.238677 229.462067,218.047767 241.366994,193.437035 C241.366994,193.437035 255.999233,166.402027 255.999233,128.645368 C255.999233,93.3274168 241.569017,68.8321265 241.569017,68.8321265 L200.024428,79.9578224 L174.793197,146.408963 L168.552129,155.57215 L167.303915,157.231625 L165.64444,159.309576 L162.729537,162.628525 L158.56642,166.791642 L136.098575,185.09637 L79.928962,217.528279 L70.5853976,271.865254 Z" />
      <path fill="#FBBC04" d="M12.6120081,188.891517 C26.3207125,220.205084 52.7568668,247.730719 70.6431185,271.8869 L165.64444,159.352866 C165.64444,159.352866 152.260416,176.856717 127.981579,176.856717 C100.939355,176.856717 79.0920095,155.2619 79.0920095,128.032084 C79.0920095,109.359386 90.325932,96.5309245 90.325932,96.5309245 L25.8373003,113.811107 L12.6120081,188.891517 Z" />
      <path fill="#4285F4" d="M166.705061,5.78651629 C198.256727,15.959818 225.262874,37.3165365 241.597878,68.8104812 L165.673301,159.28793 C165.673301,159.28793 176.907223,146.228586 176.907223,127.671329 C176.907223,99.8065834 153.443693,78.990998 128.09702,78.990998 C104.128433,78.990998 90.3620076,96.4659886 90.3620076,96.4659886 L90.3620076,39.4666386 L166.705061,5.78651629 Z" />
      <path fill="#1A73E8" d="M30.0148476,45.7654275 C48.8607087,23.2182162 82.0213432,0 127.736265,0 C149.915506,0 166.625695,5.82259183 166.625695,5.82259183 L90.2898565,96.5164943 L36.2054099,96.5164943 L30.0148476,45.7654275 Z" />
      <path fill="#EA4335" d="M12.6120081,188.891517 C12.6120081,188.891517 0,164.194204 0,128.414485 C0,94.5972757 13.145926,65.0369799 30.0148476,45.7654275 L90.3331471,96.5237094 L12.6120081,188.891517 Z" />
    </g>
  </svg>
);

export const IconWaze = ({ size = 38 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 38 38" aria-hidden>
    <rect width="38" height="38" rx="9" fill="#33CCFF" />
    <g transform="translate(7 7)" fill="#fff">
      <path d="M13.218 0C9.915 0 6.835 1.49 4.723 4.148c-1.515 1.913-2.31 4.272-2.31 6.706v1.739c0 .894-.62 1.738-1.862 1.813-.298.025-.547.224-.547.522-.05.82.82 2.31 2.012 3.502.82.844 1.788 1.515 2.832 2.036a3 3 0 0 0 2.955 3.528 2.966 2.966 0 0 0 2.931-2.385h2.509c.323 1.689 2.086 2.856 3.974 2.21 1.64-.546 2.36-2.409 1.763-3.924a12.84 12.84 0 0 0 1.838-1.465 10.73 10.73 0 0 0 3.18-7.65c0-2.882-1.118-5.589-3.155-7.625A10.899 10.899 0 0 0 13.218 0zm0 1.217c2.558 0 4.967.994 6.78 2.807a9.525 9.525 0 0 1 2.807 6.78A9.526 9.526 0 0 1 20 17.585a9.647 9.647 0 0 1-6.78 2.807h-2.46a3.008 3.008 0 0 0-2.93-2.41 3.03 3.03 0 0 0-2.534 1.367v.024a8.945 8.945 0 0 1-2.41-1.788c-.844-.844-1.316-1.614-1.515-2.11a2.858 2.858 0 0 0 1.441-.846 2.959 2.959 0 0 0 .795-2.036v-1.789c0-2.11.696-4.197 2.012-5.861 1.863-2.385 4.62-3.726 7.6-3.726zm-2.41 5.986a1.192 1.192 0 0 0-1.191 1.192 1.192 1.192 0 0 0 1.192 1.193A1.192 1.192 0 0 0 12 8.395a1.192 1.192 0 0 0-1.192-1.192zm7.204 0a1.192 1.192 0 0 0-1.192 1.192 1.192 1.192 0 0 0 1.192 1.193 1.192 1.192 0 0 0 1.192-1.193 1.192 1.192 0 0 0-1.192-1.192zm-7.377 4.769a.596.596 0 0 0-.546.845 4.813 4.813 0 0 0 4.346 2.757 4.77 4.77 0 0 0 4.347-2.757.596.596 0 0 0-.547-.845h-.025a.561.561 0 0 0-.521.348 3.59 3.59 0 0 1-3.254 2.061 3.591 3.591 0 0 1-3.254-2.061.64.64 0 0 0-.546-.348z" />
    </g>
  </svg>
);

export const IconAppleMaps = ({ size = 38 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 38 38" aria-hidden>
    <defs>
      <clipPath id="psg-applemaps-clip">
        <rect width="38" height="38" rx="9" />
      </clipPath>
    </defs>
    <g clipPath="url(#psg-applemaps-clip)">
      <rect width="38" height="38" fill="#ECEAE3" />
      <circle cx="6" cy="7" r="9" fill="#93D27E" />
      <rect x="0" y="30" width="38" height="8" fill="#A9D4EE" />
      <path d="M2 34 L30 4" stroke="#D2CDC2" strokeWidth="7.5" strokeLinecap="round" />
      <path d="M2 34 L30 4" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" />
    </g>
    <path
      fill="#FB3B30"
      d="M19.4 10.2c-3.2 0-5.8 2.5-5.8 5.7 0 4.2 5.8 10 5.8 10s5.8-5.8 5.8-10c0-3.2-2.6-5.7-5.8-5.7Z"
    />
    <circle cx="19.4" cy="15.8" r="2.1" fill="#fff" />
  </svg>
);
