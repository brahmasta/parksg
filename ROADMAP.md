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
| **JTC industrial carparks** | `migrateJtc` in `migrate-to-supabase.ts` (`npm run ingest:jtc`) ingests the 28-carpark JTC Carpark Information dataset (`data.gov.sg`), reusing the HDB SVY21 + upsert path. `agency='JTC'`, `source='JTC'` (new enum label), all geocoded; metadata + coords only (no fabricated rates). Adds industrial-estate coverage (AMK / Bukit Merah / Aljunied / Depot Lane) the HDB feed lacks |
| **CapitaLand JustPark live availability** | `api/justpark-availability.ts` (Node runtime, 60s cache) performs the reverse-engineered antiforgery handshake against `justpark.capitaland.com` and returns live lot counts keyed by DB carpark id for **11 CapitaLand malls** (Bedok Mall, Bugis+, Funan, IMM, Junction 8, Lot One, Plaza Singapura, Raffles City, Tampines Mall, The Atrium@Orchard, Westgate) that previously showed rates only. Pure parser + mapping in `src/lib/server/justpark.ts` (7 fixture-backed tests); merged authoritatively in `useCarparks.ts` `buildLiveLotsIndex` |
| **Cross-band cost stitching** | `estimateCostCentsAt` (`rateMath.ts`) walks the stay block-by-block, charging each block at the band covering its start time, so a stay spanning peak + off-peak pays each portion at its real rate (HDB Central 16:00→18:00 now $3.60 not $4.80). Caps are session-scoped (grouped by cap value), so HDB's $12/$20 day cap and $5 night cap apply to their own sessions independently. Reduces to the old single-band behaviour when rows have no time bands; 5 new tests + all 16 prior cases green |

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

### 1. DataMall audit — finish the long tail ✅ AUDITED (2026-05-31)

**Audit result (`npm run audit:datamall`, 2026-05-31):** the live
`CarParkAvailabilityv2` feed carries **only 39 LTA-managed carparks** — there is
no large hidden long tail. All 39 already exist in the DB (`source='LTA_DATAMALL'`)
with real `Development` names (not bare `CarParkID`s), geocoded coords, and live
availability, so they all render on the map today. Breakdown:

- **27 / 39** are curated `ratesOnly` malls → verified 2025 rates + capacity **and**
  live counts. (One curated mapping, `LTA:8` The Heeren, has dropped out of the
  live feed — DataMall no longer returns it; rates still serve, no live count.)
- **12 / 39 uncurated** (still on stale 2018 / fallback rates, `total_lots` null):
  Ngee Ann City `LTA:13`, VivoCity P2 `LTA:50`, Esplanade `LTA:4`, Resorts World
  `LTA:26`, Sentosa `LTA:17`, Singapore Flyer `LTA:6`, National Gallery `LTA:56`,
  CQ @ Clarke Quay `LTA:59`, Cineleisure `LTA:11`, Hilton Orchard `LTA:12`,
  Concorde Hotel `LTA:22`, Orchard Point `LTA:7`. Mostly hotels/attractions, not
  high-traffic shopping malls — low curation priority. (Two have title-case-mangled
  names from the ingest transform: "Vivocity P2", "Cq @ Clarke Quay" — cosmetic.)

**Sub-tasks closed:**
- *Enumerate the uncurated LTA malls* → done (12 above).
- *Surface `Development` not bare `CarParkID`* → already true for all 39; nothing to fix.
- *Stale Results footer copy* → updated "Private mall carparks not shown" → "Some
  mall carparks show rates only, no live count" (`ResultsScreen.tsx`).
- *Can the 23 "full" curated malls (Causeway Point, NEX, …) recover live
  availability?* → **No.** They are not in the DataMall feed at all (the feed is
  the 39 LTA carparks, all accounted for); DataMall simply doesn't carry these
  operator-run malls. They keep static rates + capacity and show "—" for live count.
  Live availability for them would need operator APIs. (The 11 CapitaLand malls
  among the curated set now get live counts via the shipped JustPark scraper, P2 #3.)

**Remaining (optional, low priority):** hand-curate verified 2025 rates + capacity
for the 12 uncurated above (Ngee Ann City is the most notable, 516 lots). Same
workflow as the curated-50 pass (`curated-malls.json` + `npm run migrate:malls`).

---

### 2. JTC + NParks datasets ingest — ✅ JTC SHIPPED · ⏸ NParks deferred (2026-05-31)

**JTC — done.** `scripts/migrate-to-supabase.ts` gained a `migrateJtc` pass
(`npm run ingest:jtc`, or part of a full sync). The JTC Carpark Information dataset
(`data.gov.sg` `d_3b0c377cde41041c93f893d0a92e9fe7`) shares the HDB CKAN record
shape, so it reuses the SVY21→WGS84 conversion + `titleCase` + batch upsert.
**28 industrial-estate carparks** ingested (`agency='JTC'`, `source='JTC'`), all
geocoded, in the Ang Mo Kio / Bukit Merah / Aljunied / Depot Lane estates. The
`rate_source` enum gained a `JTC` label (the `agency` enum already had `JTC`).

Metadata + coords only — JTC's short-term rate card isn't in the dataset and most
rows are season-parking-only (`short_term_parking=NO`), so no rate_rows are
fabricated; these carparks use the runtime operator fallback (same as the
`LTA_DATAMALL` lots). The runtime needed no change: `dbRowToCarpark` already maps
any non-HDB/URA/LTA agency to the `LTA` operator fallback.

**NParks — deferred.** No open *tabular* carpark dataset is discoverable on
data.gov.sg (the dataset-search API surfaces nothing matching "NParks car park
lots"; the reference in this ROADMAP was optimistic). NParks park-carpark data
appears to exist only as geospatial/KML layers, which need a different ingest path
(GeoJSON poll-download + geometry centroid) than the CKAN `datastore_search` used
here. Revisit if/when a tabular source or the geospatial layer is confirmed.

---

### 3. CapitaLand JustPark scraper ✅ SHIPPED

**Live availability for 11 CapitaLand malls** that previously showed "rates only,
no live count": Bedok Mall, Bugis+, Funan, IMM, Junction 8, Lot One, Plaza
Singapura, Raffles City, Tampines Mall, The Atrium@Orchard, Westgate.

**Reverse-engineered contract** (`src/lib/server/justpark.ts`): the page tunnels
every data call through a single generic proxy — `POST /AjaxNoAuth/OnHttpPost`
with the real target action in the `X-APIAction: SelectSiteNoAuth/OnSelectSite`
header, `x-ModID: FELotAvail`, and the antiforgery `__RequestVerificationToken`
header. The antiforgery handshake needs a real session: GET `/Lot-Availability`
first for the session cookies (`__RequestVerificationToken` HttpOnly + Azure
`ARRAffinity`) **and** the hidden form token, then replay both on the POST. Body:
multipart `JData={"DisplayType":"LotAvail","LotType":null}`. Response envelope
`{HasError, Message, Result}` where `Result` is a *stringified* JSON array of
sites (`SiteCode, SiteDesc, BusinessUnitDesc, LotBalance, LotTotal, IsFull`).
Posting straight to `/SelectSiteNoAuth/OnSelectSite` (no proxy) 302s to `/Error`.

**Implementation:**
- `src/lib/server/justpark.ts` — pure parser (`parseJustParkResponse`,
  `toCarparkLots`, `SITE_TO_CARPARK_ID` mapping) + `fetchJustParkLive()`
  handshake. 7 unit tests against a captured fixture
  (`scripts/data/justpark-sample.json`), incl. a guard that every mapped
  SiteCode still resolves against the live feed (catches stale codes).
- `api/justpark-availability.ts` — Node-runtime serverless proxy (Node, not edge,
  for `Headers.getSetCookie()` cookie round-trip), 60s module cache + stale
  fallback, returns lots already keyed by DB carpark id. No API key/secret.
- `src/lib/api/justpark.ts` + `useCarparks.ts` merge — JustPark written last and
  authoritative in `buildLiveLotsIndex` (overrides any stale DataMall figure for
  the same id). Wired into the search, periodic-refresh, and load-by-id paths.

**Feed has 91 sites total** (13 Retail malls, 8 Commercial towers, 70 business
parks/industrial). Only the 11 curated malls are mapped; Clarke Quay (CQ) and
Sengkang Grand Mall (SGM) appear in the feed but aren't curated in the DB yet —
add a row + an entry to `SITE_TO_CARPARK_ID` to surface them. The Commercial
towers (Asia Square T2, 21 Collyer Quay, …) are future candidates too.

**Fragility:** scrape-only, no API contract — if CapitaLand changes the proxy
shape the parser test's "site code resolves" assertion will start failing.

---

### 4. Cross-band cost stitching for long stays ✅ SHIPPED

`estimateCostCentsAt` (`rateMath.ts`) now **walks the stay block by block** from
the entry hour, charging each block at the band covering that block's start time
(within the matching `dayType`). A stay that spans peak + off-peak pays each
portion at its real rate instead of the entry band's rate for the whole duration
(e.g. HDB Central 16:00 → 18:00 is now $1.20/30min until 17:00 then $0.60/30min →
$3.60, vs the old $4.80).

**Cap handling is session-scoped, not per-band.** HDB's $12/$20 *day* cap is
attached to both the peak and off-peak rows (equal `cap_cents` — together they
are the one 07:00–22:30 session), while the $5 night cap sits on the night row.
The estimator groups accumulated charges by cap *value* and applies each distinct
cap once to its group's subtotal — so a 12h Central stay correctly sums its day
session against $20 and its night session against $5 independently, rather than
double-capping. Rows with no cap (Coupon, peak-restructured MANUAL) sum uncapped.

**Reduces exactly to the old single-dominant-band behaviour** when the matching
rows have no time bands (one all-day band is picked for every block), so all 16
prior `estimateCostCentsAt` cases still pass; 5 new stitching tests cover the
peak→off-peak crossing, day→night cap independence, and the off-peak→peak walk.
Handles midnight wrap (minutes-from-midnight cursor `% 1440`). Falls back to
`estimateCostCents` when no row matches the day or nothing is priceable.

**Affected:** the 16 HDB Central carparks + any URA/mall rows with time bands.

---

## Quick wins (under half a day each)

> ✅ **All shipped (2026-05-31).** See per-item notes below.

- ~~**LotType coverage** — `dbRowToCarpark` hardcodes `lotTypes: ['C']`. Motorcycle and heavy types are in the DB but dropped. Surface them with `LotTypeChips` in Detail.~~ ✅ The HDB availability feed lists a `carpark_info` row per vehicle type; `getHdbAvailability` (`hdb.ts`) now collects all of them (`C`/`Y→M`/`H`) into `HdbAvailability.lotTypes`, threaded through `buildLiveLotsIndex` → `dbRowToCarpark` so Detail's `LotTypeChips` shows real Car/Motorcycle/Heavy chips. Non-HDB agencies (which don't break availability out by type) stay car-only.
- ~~**EV stale threshold** — `EV_STALE_MINUTES = 5` in `ev.ts`. DataMall refreshes every ~5 min, so the "stale" banner fires aggressively. Bump to 8 min.~~ ✅ Bumped to 8 (one refresh cycle of headroom past the ~5-min `/EVCBatch` cadence + proxy/poll latency).
- ~~**Stale-rates banner scope** — `isDatagovRates` in `DetailScreen` checks `source === 'LTA_DATAGOV'`.~~ ✅ **Verified safe — no false-positives.** A carpark's rows are single-source (`migrate-curated-malls` deletes by `carpark_id` before insert) and the runtime fallbacks (`ratesFor`) only emit `HDB`/`URA`/`MANUAL`, never `LTA_DATAGOV`. So the exact-match can't fire on a URA/HDB/JTC/curated carpark. Documented inline.
- ~~**`deriveArea()` in `saves.ts`** — falls back to generic "HDB carparks". Improve with a postal-district lookup to get real area names in the Saved feed.~~ ✅ New `src/lib/postalArea.ts` maps the SG postal *sector* (first 2 digits of the 6-digit code, URA district guide) → a recognizable locality ("Orchard", "Tampines", …). `deriveArea` tries the postal locality first (works for malls/URA/LTA addresses carrying a postal), then the HDB block-name hint, then the operator. 8 unit tests (`postalArea.test.ts`).
- ~~**Results footer copy** — "Private mall carparks not shown" should be updated once JustPark scraper and DataMall audit land.~~ ✅ Both landed; copy now reads "Some mall carparks show rates only, no live count" — still accurate since non-CapitaLand malls (Wilson/Mapletree/etc.) remain rates-only.

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
| CapitaLand JustPark ✅ | `justpark.capitaland.com` → `POST /AjaxNoAuth/OnHttpPost` (`X-APIAction: SelectSiteNoAuth/OnSelectSite`) | None (public, antiforgery handshake) | 11 malls live (13 retail + 8 commercial + 70 biz-park in feed) | near-real-time; scrape-only |

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
