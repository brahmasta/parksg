# Carpark detail page — simplification proposal (PARKED, pending data)

**Status:** parked on purpose. Decide no earlier than **2026-10-03** (two weeks of click data).
**Raised:** 2026-09-19. **Owner:** Bram.
**Why parked:** per-control click tracking only went live 2026-09-19. Judging features on
4 hours of data is how you delete something people use. Monitor first.

---

## How to pick this up later

Paste the block below as a prompt. It is written to be self-contained — a fresh session
needs no other context.

```text
Read docs/detail-page-simplification.md in this repo.

Check the current numbers before recommending anything:
  1. Open /admin -> Features tab. Note: total clicks recorded, days of tracking, and which
     of the 46 roster features are still at zero.
  2. Query Supabase (project: wheretopark) for the durable-table counts in the
     "Evidence as of 2026-09-19" table below, so we can see what moved.
  3. Tell me which of the four open questions at the bottom of the doc the data now answers,
     and which it still cannot.

Then either (a) recommend we proceed with the design in this doc, (b) recommend changes to
it, or (c) tell me it is still too early and say what number would change that.

Do NOT implement anything until I say go.
```

---

## The decision gates

Do not act on feature-usage data until **both** are true:

| Gate | Threshold | Why |
|---|---|---|
| Sample size | **≥ 200 ui_click events** | Below this a zero is noise, not a signal |
| Elapsed time | **≥ 7 days** (prefer 14) | Covers a full weekly cycle — parking is weekday/weekend shaped |

The Features tab enforces this itself: it shows "not yet seen" instead of "unused" until
both thresholds pass (`src/admin/AdminFeatures.tsx`, `CONFIDENCE_CLICKS` / `CONFIDENCE_DAYS`).

---

## Evidence as of 2026-09-19

Audience over the trailing 30 days, after bot classification:

| | Value |
|---|---|
| Real people | 432 |
| Automated (crawlers) | 4,688 |
| Uncertain | 791 |
| Daily active people | ~21 |
| Daily searches / visits | ~11 / ~38 |
| 7-day return rate | 35.2% |

Durable tables — **3.5 months** of history (data since 2026-06-07), so these are NOT a
sample-size problem:

| Feature | All-time | Last 30d | Gated? | Is the number a verdict? |
|---|---|---|---|---|
| Searches | 2,812 | 577 | no | yes — this is the product |
| Sign-in (accounts) | 8 | 2 active | — | **yes** — and only 1 person ever returned |
| Check-ins | 1 | 0 | **yes, UI** | **no** — verdict on the gate |
| Inaccuracy reports | 2 | 0 | no | yes |
| Suggest edit | **0** | 0 | no (email only) | yes |
| New-carpark submissions | 1 | 0 | no (email only) | yes |
| Saved carparks | 2 | 0 | — | **NO — see caveat** |
| Saved destinations | 5 | 0 | — | **NO — see caveat** |

### Caveat 1 — saves are device-local, so the DB undercounts them

`src/lib/saves.ts:267` — `// Best-effort cloud mirror (no-op when signed out)`. Every save
writes to localStorage; it only reaches Supabase if the user is signed in. With 8 sign-ins
ever, `saved_carparks = 2` measures **sync**, not **saves**. Real save usage is invisible
server-side and can only be seen now via the `carpark_saved` / `saved_open` click events.

### Caveat 2 — check-ins are gated by UI choice, not by the backend

`record_checkin` is already granted to `anon` in Postgres. The block is purely
`CheckinCard.tsx` calling `onRequireSignIn` when `!user` ("Sign in to report — tap a status
to continue"). Ungating is a small change, not a migration.

---

## Proposed design

Principle: **one screen, one answer** — what will this cost, is there space, take me there.
Everything else earns its way back through one tap. Nothing is deleted; every feature stays
reachable in **at most two taps**.

### Current render order (`src/screens/DetailScreen.tsx`, 979 lines)

| # | Block | Line | Disposition |
|---|---|---|---|
| 1 | Top bar (back / share / save) | 258 | keep |
| 2 | Identity (name, agency, distance) | 348 | keep |
| 3 | Google unverified banner (conditional) | 392 | keep |
| 4 | **Stat cards — cost + availability** | 422 | keep, **give more room** |
| 5 | Check-in "is it full right now?" | 540 | -> More details *(see open question 1)* |
| 6 | EV charging | 548 | -> More details *(conditional promote)* |
| 7 | Walk map | 551 | -> More details (already hidden on desktop) |
| 8 | Plan your stay | 609 | -> More details |
| 9 | Rate schedule | 635 | keep visible, all sections closed |
| 10 | Save explainer card | 697 | -> one-time toast on first save |
| 11 | Meta / last refreshed | 749 | -> More details |
| 12 | Suggest an edit | 787 | -> "Something wrong?" sheet |
| 13 | Report inaccuracy | 817 | -> "Something wrong?" sheet |
| 14 | Sticky Navigate CTA | 845 | keep |

13 visible blocks -> 7.

### The two disclosures

**"More details"** — one closed section holding EV, walk map, plan-your-stay, check-in and
the refresh timestamp. Persist open/closed per device in localStorage so a user who wants
the detail gets it once and keeps it.

*Conditional exception:* if the carpark has EV **and** the user arrived with the EV filter
on, promote EV back out of the disclosure. They already said what they care about.

**"Something wrong?"** — a text link replacing two full-width buttons, opening a
`BottomSheet` with both "Suggest an edit" and "Report inaccuracy". Both survive at two taps.

### Mobile vs desktop

Desktop reuses the same `DetailScreen` component and already passes `hideWalkMap` and
`hideDurationStrip` (`src/desktop/FindParkingDesktop.tsx:145`), so its "More details" holds
only EV, check-in and the timestamp. The rail is `min(440px, 42vw)` — narrow enough that
the same disclosure earns its place. One component, existing prop idiom, no layout branch.

### Mechanics — reuse, don't invent

Three disclosure idioms already exist: the `RateTable` accordion (`RateTable.tsx:32`),
`StayPlanner`'s `collapsible` prop, and the `hideWalkMap` / `hideDurationStrip` props.
Extract one small `<Disclosure>` matching `RateTable`'s header styling; use it for both.

**Render contents always and hide with CSS**, not `{open && <X/>}` — otherwise the walk map
and EV section remount on every toggle and refetch the OneMap route.

### Non-risk: SEO is unaffected

`api/_seo/render.ts` builds the `/carpark/:slug` HTML and JSON-LD completely independently
of `DetailScreen.tsx`. Collapsing anything in the SPA cannot affect indexing.

---

## Open questions the data should answer

1. **Check-ins — gate or feature?** Ungate first (key on the anonymous `client_id`), leave
   the card visible two weeks, then decide where it lives. Hiding it now means never
   learning whether the gate was the problem. *This is the one thing worth doing BEFORE the
   redesign.*
2. **Saves — actually used?** Watch `carpark_saved` and `saved_open` clicks. If real, the
   two-tap cost of "More details" matters and localStorage persistence is essential.
3. **Rate schedule — opened or ignored?** No roster id covers the `RateTable` accordion
   (`RateTable.tsx:32` is untagged). If we want this answered, add `rate_schedule_expand`
   to `src/lib/featureInventory.ts` and tag it.
4. **EV — worth its slot?** Watch `filter_ev` and `ev_connector_expand`.

## Also untracked (add to the roster if we want them measured)

- "Search wider" radius CTA — `AvailableEmptyResults.tsx:94`, `ResultsScreen.tsx:472`
- Saved-view filter chips — `SavedScreen.tsx:134`
- Rate-schedule accordion — `RateTable.tsx:32`

## Unrelated cleanup spotted

`SearchField` in `src/components/atoms.tsx:282` is dead code — exported, referenced nowhere.
Its `search_clear` / `search_submit` tags will never fire (the live ones are in
`PlaceAutocomplete.tsx`).
