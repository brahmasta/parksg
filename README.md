# parksg

Singapore parking finder — ranks nearby HDB / URA / LTA carparks by cost for a planned duration. Built from the `Parking Finder.zip` design handoff.

## Stack

- Vite + React 19 + TypeScript
- Tailwind v4 (CSS-first; design tokens live in `src/index.css`)
- Mock data only (no live LTA / URA / HDB calls — backend stubs documented in the brief)

## Run

```
npm install
npm run dev
```

The viewport is designed for 390pt (iPhone 14). On screens >480px wide the app renders inside a stylized device frame; on phones it goes edge-to-edge.

## What's shipped

- **Home / Search** — destination input, "Use my location", planned-stay chip strip, recent destinations
- **Results** — cost-ranked carpark cards with "BEST" badge on cheapest, list/map toggle, loading + degraded + empty states, "Available only" filter
- **Detail** — identity block, EST.COST + AVAILABLE stat cards, static walk map, in-screen duration adjuster, collapsible rate schedule, sticky Navigate CTA with toast

Defaults (per design sign-off): **light theme**, **teal accent**, **badge** highlight.

## Layout

```
src/
├── App.tsx               state machine + screen routing
├── main.tsx
├── index.css             design tokens + animations
├── lib/
│   ├── types.ts          Carpark, RateRow, ResultsState, ...
│   ├── mockData.ts       Vivocity + 5 carparks
│   └── availability.ts   status helpers, formatters
├── components/
│   ├── icons.tsx
│   ├── atoms.tsx         AvailabilityDot, DurationStrip, SearchField, ...
│   ├── CarparkCard.tsx
│   ├── RateTable.tsx
│   ├── WalkMap.tsx
│   ├── DegradedBanner.tsx
│   └── Wordmark.tsx
└── screens/
    ├── HomeScreen.tsx
    ├── ResultsScreen.tsx (includes loading, empty, map view)
    └── DetailScreen.tsx
```

## Not shipped (per brief — out of MVP scope)

- Live data fetching (LTA Datamall, URA Data Service, HDB via data.gov.sg)
- OneMap autocomplete
- "Near me" GPS (the button stubs to mock data)
- Account / Save flow (UI present, no persistence)
