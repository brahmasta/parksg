# wheretopark.sg — Roadmap

_Last updated: May 2026 (rev 2). Based on full codebase audit of `brahmasta/parksg`._

---

## What's shipped (as of last audit)

These are done and in production — some weren't in the original README.

| Feature | Notes |
|---|---|
| Home / Search / Results / Detail screens | Full UI per design handoff |
| HDB real-time availability | `data.gov.sg` API, 60s refresh |
| LTA DataMall availability proxy | Vercel Edge, covers HDB + URA + LTA agencies |
| Google Places typeahead + OneMap geocoder fallback | Server-side proxied |
| **Supabase DB backbone** | Static carpark metadata + `rate_rows` table; `dbCarparks.ts` fetches via PostgREST with bounding-box + haversine refine |
| **LTA EV charging** | `/api/lta-ev-availability` proxy, `ltaEv.ts` client, ≤50m spatial join, EV filter pill in Results, `EVSection` in Detail |
| **Real OneMap walk-map polyline** | `RealWalkMap` + `useWalkRoute` hook; haversine fallback when OneMap is slow |
| **LTA-CSV rates ingested** | `scripts/ingest-lta-rates.ts` parses 357-row data.gov.sg dataset → `src/lib/data/ltaRates.json`; UI shows stale-data warning (2018 snapshot) |
| **Google Sign-in + Saves (device-local)** | Google OAuth popup → userinfo → localStorage session; saved carparks + destinations with Home chip strip |
| **Vercel Analytics + Supabase search logging** | `record_search` / `record_sign_in` RPCs; screen-change events via Vercel |
| "Available only" filter | Wired, persists to localStorage |
| List / map toggle | `RealResultsMap` with Leaflet |
| CHEAPEST badge | Ranked by `estByHours[duration]` |
| PWA install prompt | `InstallPrompt` component, Home screen only |
| Deep-link `?cp=<id>` | Opens carpark Detail on cold load |
| **URA live rate schedules** | `api/ura-token.ts` (token cache) + `api/ura-carpark-details.ts` + `src/lib/api/uraDetails.ts`; daily ingest cron `api/cron/ura-rates-ingest.ts` (18:00) → 3,905 `rate_rows` (`source='URA'`); `applyUraRates()` wired into `useCarparks.ts`. Replaces the flat $1.20/30min fallback for URA carparks |
| **HDB rate ingest + Central-Area refinements** | `scripts/lib/hdb-rates.ts` rule engine + `npm run migrate:hdb-rates` → 12,257 `rate_rows` (`source='HDB'`), priced at runtime via `computeEstByHours`. Encodes the $12/$20 day caps + $5 night cap + 15-min EPS grace + EPS/COUPON branching. The Central $1.20/30min premium is correctly time-banded to **Mon–Sat 07:00–17:00 only** (reverts to $0.60 evenings/Sun/PH/night — fixing a ~2× evening/weekend over-charge). Central-Area allowlist corrected to HDB's authoritative 16 carparks (dropped 2 loading-bay false positives, added DUXM/PRM/SLS) |
| **SSR / SEO routes** | `api/carpark.ts` + `api/parking-near.ts` server-render Detail + area pages with JSON-LD; `api/sitemap.ts`; shared helpers in `api/_seo/` (`db.ts`, `areas.ts`, `render.ts`). Uses generated `slug` column |
| **Curated mall rates (verified 2025)** | `scripts/data/curated-malls.json` (51 top malls) + idempotent `npm run migrate:malls` → 270 `rate_rows` (`source='MANUAL'`). 23 malls also get correct coords (fixes "invisible on map"); 28 DataMall malls get fresh rates via `ratesOnly` while keeping live availability. `migrate-to-supabase.ts` guards MANUAL ids from full-sync clobber |
| **Mall capacity (`total_lots`)** | Hand-sourced for 30 of the 51 curated malls (operator sites / parkopedia / parkaholic); ingest patches `total_lots` for both full + `ratesOnly` malls. Detail shows "X of N lots" |
| **Availability "no data" handling** | `api/lta-availability.ts` no longer coerces a missing `AvailableLots` to `0` (which rendered a false "Full"); missing → `null` → UI shows "—", distinct from a genuine `0`/"Full" |
| **Saves cloud sync** | Supabase `saved_carparks` + `saved_destinations` tables (RLS-locked, SECURITY DEFINER RPCs keyed by Google `sub`); `src/lib/api/saves-sync.ts` mirrors toggles cloud-side and `merge_saves` hydrates on sign-in (last-write-wins by `saved_at`). `Session.syncedAt` now reflects a real merge — the "Saves synced" toast is no longer a stub |
| **Public-holiday-aware pricing** | `src/lib/data/sgPublicHolidays.json` (MOM-gazetted 2025–2026 dates incl. in-lieu Mondays); `currentDayType()` returns `SUN_PH` on any gazetted PH so carparks bill at the Sunday/PH rate instead of the wrong weekday rate. Covered by `src/lib/uraJoin.test.ts` (6 cases) |

---

## Immediate priorities (P1)

> ✅ **Shipped since last rev:** URA live rate schedules (token endpoint + daily
> ingest cron + `applyUraRates` wiring), **Saves cloud sync** (Supabase tables +
> RPCs, `saves-sync.ts`, `merge_saves` hydration, real `syncedAt`), and **HDB rate
> hydration refinements** (Central-Area $1.20 premium time-banded to Mon–Sat
> 07:00–17:00; $12/$20/$5 caps + 15-min grace + EPS/COUPON branching verified;
> authoritative 16-carpark Central allowlist; post-2022 "peak restructuring"
> confirmed N/A for normal car lots), plus the **public-holiday calendar**
> (`sgPublicHolidays.json` + PH-aware `currentDayType`) — all now in production.
> See the "What's shipped" table.

---

## Short-term (P2)

### 1. DataMall audit — finish the long tail

**Status:** Largely addressed. The curated-malls pass confirmed the high-traffic LTA-managed malls already in the DataMall feed (VivoCity `LTA:16`, ION `LTA:23`, Marina Square `LTA:2`, Raffles City `LTA:3`, IMM `LTA:53`, etc. — 28 in total) and now carries verified rates + `Development` names + capacity for them. The remaining work is the long tail beyond the curated 51:

**What's left:**
- Run `npm run audit:datamall` to enumerate the *other* `Agency: LTA` malls not yet curated
- Surface their `Development` name (not the bare `CarParkID`) in the UI
- Update any stale Results footer copy ("Private mall carparks not shown") now that malls do appear
- Decide whether the 23 "full" curated malls (e.g. Causeway Point `LTA:causeway_point`, NEX) can be matched to a DataMall `CarParkID` to recover **live availability** (currently they only have static rates + capacity, never a live count)

**Impact:** Closes more of the apparent "private carpark gap"; recovers live availability for malls now showing only "—".

**Effort:** ~half a day

---

### 2. JTC + NParks datasets ingest

**Status:** DB schema already supports `agency: 'JTC' | 'NPARKS'`. No ingest script yet.

**Data sources:**
- JTC Carpark Information — `data.gov.sg` dataset `d_3b0c377cde41041c93f893d0a92e9fe7`. Adds ~30–50 industrial estate carparks missing from HDB feed. No auth.
- NParks Car Park Lots — `data.gov.sg`. Adds park-carpark geometries (Bishan, East Coast, etc.). Static only.

**What's needed:** Extend `scripts/migrate-to-supabase.ts` with a JTC + NParks ingest pass.

**Effort:** ~1 day

---

### 3. CapitaLand JustPark scraper (biggest private availability win)

**Data source:** `justpark.capitaland.com/LotsAvail` — semi-real-time lots (1–5 min lag) for Lot One, IMM, Westgate, CapitaGreen, Capital Tower, Six Battery Road, CapitaSpring, Asia Square Tower 2, Raffles City.

**What's needed:**
- Vercel cron job scraping the endpoint every 2 min → store in Edge KV or Supabase
- Merge into the availability feed alongside HDB/LTA in `useCarparks.ts`
- Add carpark records to Supabase for any JustPark sites not already in the DB

**Effort:** ~3–5 days

---

### 4. Cross-band cost stitching for long stays

**Status:** Known, intentional limitation. The runtime computes each estimate for the *current* day/hour (`currentDayType(now)` + `now.getHours()` in `useCarparks.ts`/`uraJoin.ts`), so the correct band surfaces as time passes. But `estimateCostCentsAt` (`rateMath.ts`) picks a single **dominant band** and applies its per-block rate for the *entire* stay — it does not stitch costs across bands a long stay actually spans (e.g. an HDB Central stay from 15:00 → 19:00 is billed at the $1.20 peak rate for all 4h rather than $1.20 until 17:00 then $0.60). This deliberately **over-estimates** (so users aren't surprised at the gantry) and is **bounded by the daily cap**, so the error is capped and never under-quotes.

**What's needed (if we want exact multi-band totals):**
- Walk the stay minute-window across consecutive matching bands (per `dayType`), summing each band's prorated cost, instead of picking one dominant band
- Handle the day→night→next-day rollover and the daily-cap interaction across bands
- Keep the over-estimate fallback for rows lacking time bands

**Why it's low priority:** affects only multi-hour stays that cross a band boundary at the 16 HDB Central carparks + URA time-banded carparks; the cap ceilings most of the divergence, and over-estimating is the safe direction.

**Effort:** ~1 day

---

## Quick wins (under half a day each)

- **LotType coverage** — `dbRowToCarpark` hardcodes `lotTypes: ['C']`. Motorcycle and heavy types are in the DB but dropped. Surface them with `LotTypeChips` in Detail.
- **EV stale threshold** — `EV_STALE_MINUTES = 5` in `ev.ts`. DataMall refreshes every ~5 min, so the "stale" banner fires aggressively. Bump to 8 min.
- **Stale-rates banner scope** — `isDatagovRates` in `DetailScreen` checks `source === 'LTA_DATAGOV'`. Correct, but double-check it doesn't fire for URA or HDB rows if those share the same source field in edge cases.
- **`deriveArea()` in `saves.ts`** — falls back to generic "HDB carparks". Improve with a postal-district lookup to get real area names in the Saved feed.
- **Results footer copy** — "Private mall carparks not shown" should be updated once JustPark scraper and DataMall audit land.

---

## Later (P3)

### Private operator scrapers

No code yet. Assess after DataMall audit (P2 #1) confirms true gap.

| Operator | Approach |
|---|---|
| Wilson Parking | HAR-capture Wilson One mobile app API for live lots; scrape `wilsonparking.com.sg` for static rates |
| Metro Parking | Scrape `metroparking.com.sg`; HAR-capture Park&Go @SG app |
| LHN Parking | Scrape `lhnparking.com.sg` — many sites already in URA feed |
| CBM / Smart Parking / Re Sustainability | Static rate scrapes only |

**Fragility ranking** (most fragile first, QA monthly): Mapletree/VivoCity app API > Wilson One app API > JustPark HTML > individual mall sites > LHN/Metro static rate pages.

---

### Crowdsourced "lots free?" check-ins

**Pre-requisites:** Saves cloud sync (now shipped) provides the per-user cloud table pattern this builds on.

**What's needed:**
- Verified-user check-in endpoint (Supabase RPC with rate-limiting)
- Trusted-reporter gating (min account age, min check-in count before counts are surfaced)
- UI: check-in button in Detail screen; crowdsourced count shown alongside sensor count

**Why it matters:** Only realistic coverage path for MCST condos and the long tail of private carparks without sensors. No Singapore parking app currently does this.

---

### SINPA availability prediction

Dataset: `yoshall/SINPA` on GitHub + Hugging Face — 1 year of 5-min availability data across 1,687 SG lots, 3 years raw across 1,921 lots. Singapore Open Data Licence (commercial use OK).

Requires an ML inference endpoint (e.g. Vercel Serverless + ONNX model, or a hosted inference API). Hold until enough historical data has been collected from the app's own sensors.

---

### Commercial fallback: Parkopedia licence

If Phase 3 operator scrapers prove too fragile, license Parkopedia Singapore as the long-tail backstop. They're the upstream for Apple Maps and HERE Maps in SG. Paid — evaluate only after scraper maintenance cost is measured.

---

## Data sources reference

| Source | Dataset / Endpoint | Auth | Coverage | Notes |
|---|---|---|---|---|
| data.gov.sg HDB Carpark Information | `d_23f946fa557947f93a8043bbef41dd09` | None | ~2,000 HDB | SVY21 coords — convert via OneMap |
| data.gov.sg Carpark Availability | `/v1/transport/carpark-availability` | None (API key for higher limits) | HDB real-time | 1-min refresh |
| data.gov.sg LTA Carpark Rates | `d_9f6056bdb6b1dfba57f063593e4f34ae` | None | 357 malls/hotels (2018 snapshot) | Stale — use for cold-start only |
| data.gov.sg JTC Carpark Information | `d_3b0c377cde41041c93f893d0a92e9fe7` | None | ~30–50 industrial | Static only |
| LTA DataMall CarParkAvailabilityv2 | `datamall2.mytransport.sg/...` | `LTA_ACCOUNT_KEY` | HDB + URA + LTA (Orchard, Marina, HarbourFront, JLD) | Paginate with `$skip=500` |
| LTA DataMall EVChargingPoints | `datamall2.mytransport.sg/...` | `LTA_ACCOUNT_KEY` | All licensed CPOs | `/EVCBatch` for bulk 5-min sync |
| URA Data Service | `eservice.ura.gov.sg/uraDataService/...` | `URA_ACCESS_KEY` + daily `Token` | ~2,000 URA carparks | Daily token rotation required |
| OneMap | `www.onemap.gov.sg/api/` | `ONEMAP_EMAIL` + `ONEMAP_PASSWORD` | National geocoding + routing | Bearer token cached ~3 days |
| Google Places (New) | Proxied via `api/google-places-*` | `GOOGLE_PLACES_API_KEY` | Global | Typeahead + place details |
| CapitaLand JustPark | `justpark.capitaland.com/LotsAvail` | None (public HTML) | ~10 CBD malls + towers | 1–5 min lag; scrape-only |

---

## Env vars

| Var | Used by | Notes |
|---|---|---|
| `LTA_ACCOUNT_KEY` | `api/lta-availability.ts`, `api/lta-ev-availability.ts` | From `datamall.lta.gov.sg` |
| `ONEMAP_EMAIL` | `api/onemap-route.ts` | Register at `onemap.gov.sg/apidocs/register` |
| `ONEMAP_PASSWORD` | `api/onemap-route.ts` | Bearer token cached in-memory ~3 days |
| `GOOGLE_PLACES_API_KEY` | `api/google-places-*.ts` | Enable Places API (New) in Google Cloud |
| `VITE_SUPABASE_URL` | `src/lib/api/dbCarparks.ts`, `analytics.ts` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/api/dbCarparks.ts`, `analytics.ts` | Anon key (safe to ship to client; RLS enforces access) |
| `VITE_GOOGLE_CLIENT_ID` | `src/lib/auth.ts` | Google OAuth client ID for sign-in popup |
| `URA_ACCESS_KEY` | `api/ura-token.ts` _(to build)_ | From `eservice.ura.gov.sg/maps/api/reg.html` |
