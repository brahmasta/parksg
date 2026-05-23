# parksg

Singapore parking finder — ranks nearby HDB / URA / LTA carparks by cost for a planned duration. Built from the `Parking Finder.zip` design handoff.

## Stack

- Vite + React 19 + TypeScript
- Tailwind v4 (CSS-first; design tokens live in `src/index.css`)
- Live data: data.gov.sg (HDB) + LTA Datamall (URA + LTA) via a Vercel Edge proxy
- OneMap for geocoding the search box

## Required env vars

| Name | Where set | Notes |
|---|---|---|
| `LTA_ACCOUNT_KEY` | Vercel → Settings → Environment Variables | From [datamall.lta.gov.sg](https://datamall.lta.gov.sg). Used server-side only by `api/lta-availability` for URA + LTA carparks. |
| `ONEMAP_EMAIL` | Vercel → Settings → Environment Variables | Register at [onemap.gov.sg/apidocs/register](https://www.onemap.gov.sg/apidocs/register). Used by `api/onemap-route` for real walking routes. |
| `ONEMAP_PASSWORD` | Vercel → Settings → Environment Variables | Paired with `ONEMAP_EMAIL`. Bearer token is cached in-memory for ~3 days. |

Local dev works without any of them — every feature degrades gracefully.
Without LTA: HDB-only results. Without OneMap: straight-line walk
distance (haversine) on the detail screen.

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

## Roadmap

- Real URA rate schedules via the URA Data Service (daily token rotation) — currently URA carparks use a flat $1.20/30 min approximation
- OneMap autocomplete (the search box is plain text for now)
- Account / Save flow (UI present, no persistence yet)
- "Available only" filter (UI present, currently does basic filter on cards with > 0 lots)
- Render OneMap's `route_geometry` polyline on the detail walk-map
