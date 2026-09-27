# Carpark data sources — mall & office coverage

_Written 2026-09-26 in response to user feedback on Threads
(<https://www.threads.com/share/Fj1h4FdOE/>): CBD building carparks (Singapore Land
Tower, Battery Road) missing, and Tampines Mall search showing only HDB carparks._

## What the feedback turned out to be

Audited against the production DB (`carparks` + `rate_rows`) on 2026-09-26.

| Complaint | Cause | Fix |
|---|---|---|
| Tampines Mall search shows only HDB carparks | **Ranking, not data.** Tampines Mall (15m, JustPark live lots), Century Square (110m) and Tampines 1 (183m) are all in the DB with 2026-05 rates. Cost sort puts ~20 HDB carparks at $0.60/30min above the malls' ~$1.35/h, so they land at the bottom of the list. | Results now pin the destination's own carpark first ("At destination") — `src/lib/destinationMatch.ts`. |
| CBD towers missing (Singapore Land Tower, Battery Road…) | **No coordinates.** 254 `LTA_DATAGOV` carparks — the 2018 LTA "Carpark Rates" CSV — have `lat/lng = NULL`, so `fetchNearbyCarparks` drops them from every search. Includes Singapore Land Tower, Six Battery Road, One Raffles Quay, Republic Plaza, UOB Plaza, OCBC Centre, OUB Centre, Asia Square, Capital Tower, MBFC, Tampines Junction, IKEA Tampines. Their rates are also Nov-2018. | Curate the CBD towers into `scripts/data/curated-malls.json` (reusing the `LTA:` id → becomes `MANUAL` with coords + fresh rates), and map the CapitaLand towers' JustPark live lots. |

Coverage today, by source:

| agency / source | carparks | no coords | no capacity |
|---|---:|---:|---:|
| HDB / HDB | 2,265 | 0 | 2,265¹ |
| URA / URA | 661 | 1 | 3 |
| LTA / LTA_DATAMALL | 40 | 0 | 17 |
| LTA / MANUAL (curated) | 23 | 0 | 12 |
| **LTA / LTA_DATAGOV (2018 CSV)** | **254** | **254** | 254 |
| JTC / JTC | 28 | 0 | 28 |
| OPERATOR / MANUAL | 3 | 0 | 3 |

¹ HDB capacity comes from the live feed at runtime, not the DB column.

**Why not just geocode the 254 rows in place:** `migrateLtaCsv` in
`scripts/migrate-to-supabase.ts` wipes and recreates every `LTA_DATAGOV` row with
`lat/lng = NULL` on each full sync, so coordinates written onto those rows are
lost on the next run. Curated entries are `source='MANUAL'` and survive the sync
(see the `loadManualCarparkIds` guards). The long tail also contains closed or
renamed places (Liang Court, Underwater World, Jurong Bird Park, Golden Mile
Complex, the old Hilton on Orchard) and duplicates of carparks we already carry
(Tangs, The Centrepoint, Lot 1, Clarke Quay…), so it needs review, not a blind
geocode.

## Sources — prices

| Source | Covers | Freshness | Access | Use |
|---|---|---|---|---|
| **Operator / landlord websites** (CapitaLand, Frasers mall "Visit" pages, Singapore Land Group, Keppel REIT, CDL) | Their own buildings | Current | Public HTML | Primary source for curated rate cards |
| **motorist.sg** per-building pages (`/parking/<slug>-parking-rates`) | Most malls & CBD towers | Mostly 2025–26 | Public HTML | Existing curated-malls provenance; good cross-check |
| **ParkingGoWhere** (`parking-go-where.com/carpark/<slug>`) | 4,000+ carparks | Per-carpark "verified on" dates, many 2026 | Public HTML, no API | Cross-check only — don't scrape |
| **GetGo CBD parking guide** (<https://www.getgo.sg/blog/guide-to-parking-and-parking-rates-in-cbd>) | CBD towers | "Correct as of 14 Jan 2026" | Blog | Cross-check for CBD |
| **officespaces.com.sg Raffles Place guide** (<https://officespaces.com.sg/where-to-park-in-raffles-place/>) | 20+ Raffles Place carparks | Undated | Blog | Discovery list for CBD curation |
| **LTA OneMotoring "Parking Rates"** (`onemotoring.lta.gov.sg/.../parking_rates.1.html` … `.8.html`) | "Selected commercial buildings" | Unverified — likely upstream of the 2018 CSV | Public HTML | Diff a few rows vs the CSV before investing |
| data.gov.sg **Carpark Rates** `d_9f6056bdb6b1dfba57f063593e4f34ae` | 357 malls/hotels/offices | **Nov 2018**, no coordinates | Open API | Cold-start only; already ingested as `LTA_DATAGOV` |
| JTC carpark details PDF (<https://www.jtc.gov.sg/-/media/project/jtc-cx/corpweb/assets/get-help/season-parking/jtc_carpark-details_jan-2025.pdf>) | JTC public carparks, hourly + season | Jan 2025 | PDF | Could replace the rate-less JTC rows |
| URA Data Service | ~2,000 URA carparks | Daily | API key | Already ingested (daily cron) |
| HDB rules (`scripts/lib/hdb-rates.ts`) | All HDB | Rule-based | — | Already ingested |

## Sources — live lot numbers

| Source | Covers | Access | Status |
|---|---|---|---|
| data.gov.sg carpark-availability | All HDB | Open API | ✅ integrated |
| LTA DataMall CarParkAvailabilityv2 | HDB + URA + ~39 LTA carparks (Orchard, Marina, HarbourFront, JLD) | API key | ✅ integrated. API guide v6.9 (Aug 2026) adds no private carparks |
| **CapitaLand JustPark** | 91 sites: 13 retail, **8 CBD commercial towers**, 70 business parks | Scrape (antiforgery handshake) | ✅ 14 mapped: the 11 retail malls + **Clarke Quay, Six Battery Road, Capital Tower** (new). In the feed but unmapped for want of a verified rate card: CapitaGreen, CapitaSpring, CapitaSky, Asia Square Tower 2, 21 Collyer Quay (9 lots), Sengkang Grand Mall, Tampines Biz-Hub + the business parks |
| Lendlease Plus app | Parkway Parade, 313@Somerset, Jem, Paya Lebar Quarter | App-only (would need HAR capture; likely against app ToS) | Later — new live coverage would be Parkway Parade + PLQ |
| Wilson Parking / Wilson One app | Many CBD office carparks | App-only | Later (already P3 on the roadmap) |
| Frasers Property (Tampines 1, Century Square, Causeway Point, Northpoint…) | — | **No public live feed found** (FRx app does rewards/wayfinding) | Static rates only |
| Mapletree, Singapore Land Group, Keppel REIT, CDL | — | No public live feed found | Static rates only |
| Aggregators (Parkaholic, wherecrowded.sg, RoadKaki, ParkingGoWhere) | Their "live" counts are the same government feeds + JustPark | — | Nothing new — avoid |
| Parkopedia | Long tail (upstream for Apple / HERE Maps) | Paid licence | Fallback if curation doesn't scale |
| Crowdsourced check-ins (shipped) | Any carpark | In-app | The only realistic live signal for Frasers/Keppel/SLG buildings |

## CBD pack (added 2026-09-26)

Eight buildings curated into `scripts/data/curated-malls.json`, plus the
user-submitted 18 Cross Carpark (below). Coordinates are
OneMap building points (via the Open-Data-Licensed OneMap postal-code dump,
<https://github.com/xkjyeah/singapore-postal-codes>, cross-checked against the
DB's existing Tampines rows to within metres). Each entry's `provenance.note`
records the sources and any conflicts.

| Building | Id | Weekday day rate | Live lots | Confidence |
|---|---|---|---|---|
| Six Battery Road | `LTA:six_battery_road` | $3.20/30min | ✅ JustPark SBR | High (verified 2026-05-27) |
| One Raffles Place | `LTA:oub_centre` | $3.27/30min | — | Medium (weekend card conflicts with an older promo) |
| Republic Plaza | `LTA:republic_plaza` | $3.00/30min | — | Medium-low (evening/weekend from an undated page) |
| Ocean Financial Centre | `OPERATOR:ocean_financial_centre` | $1.20/10min | — | Medium (two agreeing undated sources) |
| Marina Bay Financial Centre + MBLM | `LTA:marina_bay_financial_centre_…` | $1.18/10min | — | Medium (GetGo Jan 2026; Saturday assumed = weekday) |
| Asia Square Tower 1 | `LTA:asia_square` | $1.10/10min | — | Medium-low |
| Capital Tower | `LTA:capital_tower` | $2.80/30min | ✅ JustPark CT | Medium-low (sources undated) |
| OUE Bayfront | `LTA:oue_bayfront_…` | $1.07/10min | — | Medium |
| 18 Cross Carpark (China Square Central / Cross Street Exchange; also the Great Eastern Centre carpark) | `MANUAL:18_cross_carpark` — user-submitted, admin-managed, **not** in curated-malls.json | $1.90/30min | — | High (user submission 2026-09-26; matches the Apr 2026 guide's "Cross Street Exchange $1.90/half hour") |

**Admin rate-drop bug (fixed 2026-09-27):** approving a community "new carpark"
or rate edit silently dropped every rate when any row was per-entry —
`parseRates` sent `per_block_cents/block_minutes = null` into NOT NULL columns,
failing the whole insert. 18 Cross Carpark and Stamford Place were approved
on 2026-09-26 with zero rates because of it. Fixed in `api/_admin/carparkWrite.ts`
(per-entry rows store 0/0; a `08:00`–`08:00` band is stored as all-day).

**Not added — need a check (signage, operator, or ParkingGoWhere) first:**

- **Singapore Land Tower** — LTA's 2018 record says *"For Tenants only"*; no
  public hourly rate card found anywhere. Confirm whether visitors can park at all.
- **One Raffles Quay, UOB Plaza, OCBC Centre** — only pre-2023 figures (before the
  GST rise), conflicting between sources.
- **CapitaGreen, CapitaSpring, CapitaSky, Asia Square Tower 2** — public hourly
  carparks with JustPark live lots, but no rate card found. Once one is confirmed,
  add the entry + its JustPark code and they get live counts immediately.
- **Clifford Centre** (open status unclear — possible redevelopment), **Far East
  Square, SGX Centre** (2018 rates only), **Guoco Tower** (one band only),
  **IOI Central Boulevard, Fullerton, Income at Raffles, Robinson 77** (no data).
- **8 Shenton Way** — AXA Tower site, demolished; never surface it.

## Recommended order

1. ✅ Pin the destination's own carpark (Tampines fix).
2. ✅ CBD pack: eight towers curated + 18 Cross Carpark's submitted rates restored, JustPark live lots for Six Battery Road +
   Capital Tower + Clarke Quay. Needs `npm run migrate:malls` to reach production.
3. Verify the "not added" CBD list above (starting with Singapore Land Tower and
   the four CapitaLand towers, which get live lots the moment they have a rate card),
   plus Sengkang Grand Mall.
4. Long tail: review the 254 `LTA_DATAGOV` names (drop closed/duplicate), then either
   curate the busiest ones or teach `migrateLtaCsv` to read a reviewed
   `scripts/data/lta-datagov-coords.json` so coordinates survive re-syncs.
5. Refresh curated rate cards every ~6 months (each entry carries
   `provenance.verified`; the guard test in `scripts/lib/curated-malls.test.ts`
   requires it).
