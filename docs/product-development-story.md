# wheretopark.sg — product development story

Context document for writing a post about how this product was actually built.
Everything here is drawn from the repository: commit messages, `ROADMAP.md`,
`docs/detail-page-simplification.md`, and the audit scripts. Dates and figures
are as recorded, not reconstructed from memory.

> **How to use this.** This is raw material, not a draft. Sections 3–10 are the
> method — each one is a candidate section or a candidate post on its own.
> Section 11 has quotable numbers, section 12 has post structures, and section
> 13 lists the claims the evidence does *not* support, so the post doesn't
> overreach the way the dashboard once did.

---

## 1. At a glance

| | |
|---|---|
| Product | Singapore parking finder — ranks nearby carparks by cost and distance, flags the cheapest |
| First commit | 2026-05-23, "Initial commit: ParkSG MVP" |
| Latest | 2026-09-19 |
| Commits | 122 |
| Code | ~28,600 lines across `src/`, `api/`, `scripts/` |
| Tests | 13 test files |
| DB migrations | 11 |
| Live data sources | 10 (HDB info + availability, LTA rates CSV, LTA DataMall, LTA EV, JTC, URA, OneMap, Google Places, CapitaLand JustPark) |
| Tracked UI controls | 46 |
| Real audience (30d, after bot filtering) | ~431 people · ~21 daily active · 35.2% 7-day return |

The origin is worth stating plainly: it began as a **design handoff**
(`Parking Finder.zip`) built against mock data — "Vivocity + 5 carparks" —
and everything real was integrated afterwards, in phases.

---

## 2. Timeline — the actual shape of the work

The shape matters more than the list. Four bursts and one long silence.

### Burst 1 — prove the shell (23–24 May, ~12 commits)
MVP from the design handoff, then real data in numbered phases on a single day:
Phase 1 HDB (`data.gov.sg` + OneMap), Phase 2 URA + LTA via a Vercel Edge proxy,
Phase 3 real walking routes, Phase 4 real map tiles and walking polyline. Rebrand
`ParkSG` → `wheretopark.sg` on day two.

### Burst 2 — make the prices true (25 May – 7 Jun, ~45 commits)
This is the bulk of the product, and almost all of it is data, not UI:
the LTA rates corpus, an EV charging layer, the URA rate pipeline (token
endpoint → daily ingest cron → 3,905 rate rows), the Supabase migration,
an HDB rate *rule engine* (12,257 rate rows encoding $12/$20 day caps, $5
night cap, 15-min grace, EPS/COUPON branching), curated rates for 51 malls,
JTC industrial carparks, a reverse-engineered CapitaLand JustPark scraper for
11 malls, public-holiday-aware pricing, and cross-band cost stitching.

Interleaved with it: accounts and saves, SSR/SEO, the desktop shell in six
numbered phases (P1–P6), a design-system reskin, and the admin panel.

### Burst 3 — let people correct it (13–14 Jun, ~8 commits)
Community edit proposals, customer "Add a carpark" with Google POI search,
admin review, accessibility focus rings.

### The silence (14 Jun – 19 Sep, ~3 months)
No commits. The product ran in production. **This gap is not a gap in the
story — it is the reason the next burst was possible.** The durable tables
accumulated 3.5 months of history, which is exactly what section 8 spends.

### Burst 4 — find out if any of it worked (19 Sep, 6 commits)
Self-hosted analytics, the honest traffic audit, three rounds of fixing the
analytics' own defects, a contrast audit and three themes, and a design-system
export. Then a fully-specified redesign proposal — deliberately **not** shipped.

---

## 3. Discovery: write a script, don't hold an opinion

The most repeatable lesson in this repo. Twice, a planned workstream was
resolved by a one-shot audit script instead of a debate.

**`scripts/audit-datamall.ts`** — the roadmap assumed a "long tail" of LTA
carparks worth chasing. The audit answered it:

> the live `CarParkAvailabilityv2` feed carries **only 39 LTA-managed
> carparks** — there is no large hidden long tail. All 39 already exist in the
> DB.

That single run closed four sub-tasks at once, including a definitive *no* to
"can the 23 curated malls recover live availability?" — they are not in the feed
at all. A planned effort became a documented dead end, and the 12 genuinely
uncurated malls became a small, finite, hand-curation job instead.

**`scripts/audit-osm-coverage.ts`** — read-only, matched every OpenStreetMap
car park in Singapore against the database spine by 60m haversine:

> First run: 3212 OSM / 3016 spine → 1579 net-new (285 named), 1466 of our
> carparks unmatched (HDB 849, URA 540, LTA 53, JTC 24).

That is an opportunity *sized* before anything was committed to it. Note also
the discipline inside the script: retry with mirror fallback, a histogram of
match distances "to judge the radius", and an ODbL licensing note stating that
any future ingest must isolate OSM-derived rows.

**The transferable point:** both scripts are cheap, read-only, and throwaway.
Neither shipped to users. Both changed the roadmap.

---

## 4. Narrowing: a roadmap with explicit states, including "no"

`ROADMAP.md` is not a wish list. Every item carries a state and, crucially, a
*reason* — and several are closed without being built.

| Item | Outcome | Stated reason |
|---|---|---|
| NParks dataset ingest | **Deferred** | "No open *tabular* carpark dataset is discoverable… the reference in this ROADMAP was optimistic" |
| Private operator scrapers | **Not started** | "No code yet. Assess after DataMall audit confirms true gap." |
| SINPA ML availability prediction | **Held** | "Hold until enough historical data has been collected from the app's own sensors." |
| Parkopedia commercial licence | **Held** | "evaluate only after scraper maintenance cost is measured" |
| Detail-page redesign | **Parked** | insufficient data (see section 9) |

Three things worth lifting for a post:

1. **The roadmap corrects itself out loud.** "the reference in this ROADMAP was
   optimistic" is a note-to-self admitting an earlier entry was wishful. That
   sentence is the whole discipline in nine words.
2. **Each "no" names its unblocking condition** — a measurement, an audit
   result, a cost. None is a permanent refusal; each is a deferral with a
   trigger.
3. **Fragility was ranked before committing.** The scraper section orders
   candidates "most fragile first, QA monthly" — Mapletree app API > Wilson One
   app API > JustPark HTML > individual mall sites > static rate pages. That
   ranking is a build/don't-build decision made on maintenance cost, before any
   code.

And where a scrape *was* built, its fragility is documented rather than hidden:

> **Fragility:** scrape-only, no API contract — if CapitaLand changes the proxy
> shape the parser test's "site code resolves" assertion will start failing.

The test is designed to be the tripwire.

---

## 5. Reversal: shipping is how you find out

The Google Places integration changed shape three times in one day — a clean,
small example of ship → observe → revise.

1. `c9d6a20` — **gap-fill only**: fetch Google when the database returns fewer
   than 5 nearby carparks. Carefully reasoned, with dedup within 60m, no
   persistence (Google ToS), and a "Powered by Google" attribution.
2. `fc6feae` — **always show**: "Gap-fill-only hid Google results in
   well-covered areas, so users didn't get the complete nearby picture."
3. `bbf6409` — **make the threshold an env var**, so the decision stays
   adjustable without a deploy.

The first design was not wrong on its own terms; it was wrong about the user's
question. Someone searching a well-covered area still wants the complete
picture. The fix took one commit, and the third commit removed the need to
have the argument again.

---

## 6. Data honesty as the product

The strongest through-line, and the most distinctive thing to write about. In a
product whose entire value is "what will this cost", a confidently wrong number
is worse than no number. Repeatedly, engineering effort went into *admitting
uncertainty precisely*.

**Missing is not zero.** `api/lta-availability.ts` had been coercing a missing
`AvailableLots` to `0`, which rendered as a false "Full". Now missing → `null` →
the UI shows "—", "distinct from a genuine `0`/'Full'".

**Unknown capacity is not a bug.** DataMall reports available lots but no
capacity, so "763 available" paired with "total lots unknown" read like a broken
pipeline (`DATA-1`). One helper, `lotsDisplay()`, became the single source of
truth: known capacity → "of N lots · X% free" with a capacity bar; live count
without capacity → the bare honest count; no live count → an em dash, "never a
stale ratio".

**Stale prices must not win.** A 2018 LTA snapshot price looked identical to a
live rate on the results card — and could take the CHEAPEST badge (`TRUST-1`).
Two changes: an amber "2018 RATE" chip, and `pickCheapestId` now awards the
badge among non-stale carparks first, "only falling back to the full list when
every option is stale (apples-to-apples)".

**Don't fabricate what you don't have.** Google carparks have no rates, so they
render "Rate unknown" rather than a fallback estimate, with every cost render
site guarding on `rateUnknown`. JTC carparks ship with "metadata + coords only —
no rate_rows are fabricated", because JTC's rate card isn't in the dataset.

**The copy changed when the truth changed.** A results footer reading "Private
mall carparks not shown" became "Some mall carparks show rates only, no live
count" once the audit established what was actually true.

Five separate commits, one principle: *the credibility of the number is the
product.*

---

## 7. Accessibility discovered by audit, not by complaint

A contrast audit of the stylesheet found tokens failing WCAG AA on the surfaces
they actually sit on:

> Worst was `--text-3` at 2.96:1, which carries addresses, source lines, the
> search placeholder and section labels.

The response was not a tweak but a theme built for the real use case — a phone
held at arm's length in Singapore daylight. Three things carry it: a grey page
ground so white cards read as objects, every text tier and status colour at
5.3–7.9:1, and shadows heavy enough to mean something outdoors. It became the
default. The dark theme, which "was dead code until now", was fixed at the same
time (control outlines 1.7:1 → 3.0:1).

Architecturally, the themes are token-only overrides, "so no component knows a
theme exists" — a palette can be retuned without touching a component.

---

## 8. Measurement: instrument, then discover the instrument is lying

This is the richest sequence in the repo, and the best single post. Three
commits in one day, each one finding that the previous one overclaimed.

### Round 1 — the dashboard had been wrong all along (`af967a1`)

Building self-hosted analytics started with auditing 30 days of existing
production data, and the audit invalidated the metric the dashboard led with.
"Active users" counted distinct browsers that loaded a page:

- 95% of clients (5,715 / 6,024) visited exactly once
- 5,055 of 5,364 "direct" visits landed on a *deep* path, not "/"
- Clients landing on "/" searched 35.6% of the time; deep-path-only clients, 4.8%
- Desktop outnumbered mobile — "on a phone-first app used in a car"

> Of 6,029 raw visitors, ~4,653 are automated. The real audience is ~1,376.

Also removed in the same commit: `track()` custom events that had never worked.
Vercel's custom events are a Pro feature; on Hobby they are silently dropped, so
every `screen_view` event the app had been firing "never reached any dashboard".

### Round 2 — the new analytics had three defects and two holes (`09c89d0`)

Shipped one day earlier, audited immediately:

- **The bot classifier was dismantling itself.** `carpark_viewed` and
  `results_viewed` auto-fire on deep-link cold loads. Crawlers run JS, so "every
  crawler hitting a SEO route was being promoted to 'human' within days." Fixed
  by tagging auto-fired events `auto: true` and counting only user-initiated ones.
- **"Searched" was contaminated by the same auto-fires.** Of 349 clients with a
  search row, 227 had only ever hit area deep links. "Only 68 searchers ever
  reached the home screen."
- **The funnel compared different observation windows.** Steps 1–2 read months of
  data; steps 3–5 read events that began yesterday. "'-341 dropped off'
  described missing data, not abandonment."
- **Security:** all three admin reporting RPCs were callable with the anon key
  that ships in the browser bundle. `grant execute` had read like a restriction
  but was purely additive — Postgres grants EXECUTE to PUBLIC by default.
- **Privacy:** click tracking fell through to `aria-label` and `innerText`, so it
  captured "the user's own name for a place" and "the street address being
  navigated to". Fixed by reading *only* `data-track` — "making leakage
  impossible by construction rather than by redaction".

Corrected figures: 431 people (20.8 daily active, 11.1 daily searches) vs 4,685
crawlers. **7-day return 35.2%, not the 10.5% the crawler-diluted figure showed.**

### Round 3 — the numbers were right and the presentation still lied (`2f48f10`)

> Three of the four issues were the dashboard drawing conclusions its data could
> not support.

- **A total that described nobody.** "DAILY ACTIVE PEOPLE 1,860 total" over 90
  days double-counts everyone who returned. Replaced by a per-day average, with
  a `summable` flag marking the series where a total is meaningful at all.
- **One outlier flattening everything.** Two June days carry 328 and 384
  searches — "almost all from ONE client hammering the box during development"
  against an ~18/day norm. A typical day rendered as a 2px stub. Charts now scale
  to the 95th percentile, label outliers, and state the true peak. "Median
  search day goes 2px → 26px."
- **The headline finding that was actually a clock.** This is the quotable one:

  > "UNTOUCHED — 45 OF 46" was not a finding, it was a clock. That panel
  > rendered one hour after click tracking shipped, under a caption inviting the
  > reader to conclude the features were unwanted. All 45 were merely
  > unobserved. **Absence of evidence rendered as evidence of absence.**

The fix was to build the guardrail into the tool: the Features tab "refuses the
word 'unused' until there are ~200 clicks across 7+ days; until then the column
reads 'not yet seen'."

---

## 9. Narrowing, the hard version: a finished redesign, deliberately not shipped

`docs/detail-page-simplification.md` is a complete proposal — 13 visible blocks
reduced to 7, every block's disposition decided, the disclosure mechanics
specified down to "render contents always and hide with CSS, not
`{open && <X/>}`", and a note that SEO is structurally unaffected.

It is marked **PARKED**, with a date: *decide no earlier than 2026-10-03*.

> **Why parked:** per-control click tracking only went live 2026-09-19. Judging
> features on 4 hours of data is how you delete something people use.

Four things in this document are worth a post on their own.

**1. The gates are explicit and enforced in code.**

| Gate | Threshold | Why |
|---|---|---|
| Sample size | ≥ 200 `ui_click` events | Below this a zero is noise, not a signal |
| Elapsed time | ≥ 7 days (prefer 14) | Parking is weekday/weekend shaped |

Not a norm someone has to remember — `AdminFeatures.tsx` holds
`CONFIDENCE_CLICKS` / `CONFIDENCE_DAYS` and changes its own wording until they pass.

**2. It separates "this number is a verdict" from "this number is not."**
The evidence table has a column for exactly that:

| Feature | All-time | Verdict? |
|---|---|---|
| Suggest edit | **0** | **Yes** — ungated, 3.5 months of history |
| Sign-in | 8 | **Yes** — and only 1 person ever returned |
| Check-ins | 1 | **No** — it's a verdict on the *gate*, not the feature |
| Saved carparks | 2 | **No** — saves are device-local; the DB measures *sync* |

The saves caveat is precise: every save writes to localStorage and only reaches
Supabase when signed in. With 8 sign-ins ever, `saved_carparks = 2` measures
sync. "Real save usage is invisible server-side."

**3. It proposes an experiment before the redesign.** Check-ins are gated behind
sign-in by UI choice only — the backend RPC already permits anonymous calls.
So: ungate first, leave it two weeks, then decide. "Hiding it now means never
learning whether the gate was the problem."

**4. Nothing is deleted.** "Everything else earns its way back through one tap…
every feature stays reachable in at most two taps."

---

## 10. Discoverability is not shipping

A small, sharp lesson from the last two commits. Dark mode shipped — and was

> effectively undiscoverable: two taps plus a ~400px scroll through Account,
> with no icon anywhere in a header, and no wiring to the OS setting at all.

The follow-up commit was entirely about discoverability: an `auto` preference
following `prefers-color-scheme` (and made the default, "because most people
express 'I want dark mode' through their OS setting and never open an app's
settings screen"), a sun/moon toggle in both headers, and the Appearance picker
moved from y=850 to y=521 on a 390×844 phone — from just past the fold to above it.

The same commit also documents what *could not* be verified:

> The live device-flip repaint could not be exercised in the preview pane, whose
> colour-scheme emulation does not dispatch matchMedia change events — an
> independent probe listener recorded zero fires while matches flipped.

Stating the limit of your own testing is the same instinct as stating the limit
of your own data.

---

## 11. Quotable numbers

**Audience (30 days, after bot classification)**

| | |
|---|---|
| Real people | 431–432 |
| Automated (crawlers) | 4,685–4,688 |
| Uncertain | 791 |
| Daily active people | ~21 (peak 42) |
| Daily searches / visits | ~11 / ~38 |
| 7-day return rate | 35.2% (vs 10.5% before de-botting) |

> The ranges are two snapshots taken hours apart on 2026-09-19 — commit
> `09c89d0` records 431/4,685, `docs/detail-page-simplification.md` records
> 432/4,688. Use either; don't present them as conflicting.

**Durable feature usage (3.5 months, since 2026-06-07)**

| Feature | All-time | Last 30d |
|---|---|---|
| Searches | 2,812 | 577 |
| Sign-ins | 8 | 2 active |
| Saved destinations | 5 | 0 |
| Saved carparks | 2 | 0 |
| Inaccuracy reports | 2 | 0 |
| New-carpark submissions | 1 | 0 |
| Check-ins | 1 | 0 |
| Suggest edit | 0 | 0 |

**Data pipeline**

| | |
|---|---|
| URA rate rows | 3,905 (daily cron) |
| HDB rate rows | 12,257 (rule engine) |
| Curated mall rate rows | 270 across 51 malls |
| LTA DataMall live carparks | 39 (the entire feed) |
| CapitaLand JustPark malls | 11 live, from a 91-site feed |
| JTC industrial carparks | 28 |
| OSM audit | 3,212 OSM vs 3,016 spine → 1,579 net-new candidates |

**Correctness wins worth naming**
- HDB Central premium was time-banded to Mon–Sat 07:00–17:00, "fixing a ~2×
  evening/weekend over-charge"
- Cross-band stitching: a Central 16:00→18:00 stay is now $3.60, not $4.80
- Central-Area allowlist corrected to HDB's authoritative 16 carparks (dropped 2
  loading-bay false positives)

---

## 12. Post structures worth considering

**A. "I built a dashboard that lied to me three times in one day"**
Pure section 8. Strongest hook, most transferable, needs no knowledge of
parking. Beats: the metric that counted crawlers → the classifier that promoted
crawlers to humans → the panel that was a clock, not a finding. Ends on the
guardrail: the tool now refuses to say "unused" until it has earned the word.

**B. "How to decide what not to build"**
Sections 3 + 4 + 9. The audit-script-as-discovery-instrument, the roadmap where
every no names its unblocking condition, and the finished redesign sitting
parked behind a date and two thresholds. Ends on: the gates are in code, not in
willpower.

**C. "Honest software: a parking app that says 'I don't know'"**
Section 6, with 8 and 9 as support. The most distinctive product angle —
five separate commits spent on admitting uncertainty precisely, in a product
where a confident wrong number is the worst possible output.

**D. The full build log**
Sections 2 → 10 in order. Longest, best for a personal-site write-up. The
three-month silence is the turn: build for three weeks, run for three months,
then spend a day finding out whether any of it worked.

**Framing that holds all four together:** this product's hard problem was never
the UI. It was *knowing what is true* — true prices, true availability, true
usage — and every interesting decision came from refusing to state something
more confidently than the evidence allowed.

---

## 13. Claims the evidence does not support

Guardrails for the post, in the spirit of the project.

- **Don't call it successful, or unsuccessful.** ~21 daily active people is a
  small audience. The 35.2% 7-day return is genuinely decent, but on a small base.
- **Don't claim the features are unwanted.** As of the last commit the click
  data was hours old. That is the entire point of section 9 — repeating the
  mistake in a post about the mistake would be unfortunate.
- **Saves usage is unknown, not zero.** Device-local storage means server-side
  counts undercount by an unmeasured amount.
- **Check-ins usage is unknown.** One report, behind a sign-in gate, with 8
  sign-ins ever. That measures the gate.
- **The Android app does not exist.** A design-system export was produced for
  Google AI Studio; no app has been built from it.
- **Don't imply continuous development.** There is a real ~3-month gap. It's a
  better story told straight — the gap is what produced the data.
- **"Discovery" here means data and source audits, not user research.** There
  are no user interviews, no usability sessions, no surveys in this repo. The
  discovery is instrumentation, dataset audits, and production behaviour. Say
  so — it's a legitimate method, and claiming interviews that didn't happen
  would undercut everything above.

---

## Source files

| Claim area | Where to verify |
|---|---|
| Roadmap states, deferrals, data sources | `ROADMAP.md` |
| Parked redesign, gates, evidence table | `docs/detail-page-simplification.md` |
| Analytics defects and corrected figures | `git show af967a1 09c89d0 2f48f10` |
| Data-honesty decisions | `git show cc51391 f571880 c9d6a20` |
| Contrast audit and themes | `git show 9f5c53c 464fa6d` |
| Discovery scripts | `scripts/audit-datamall.ts`, `scripts/audit-osm-coverage.ts` |
| Confidence gating in code | `src/admin/AdminFeatures.tsx` |
| Feature roster (46 controls) | `src/lib/featureInventory.ts` |
