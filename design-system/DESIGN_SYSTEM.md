# wheretopark.sg — Design System

The visual and interaction language of wheretopark.sg, written so an Android
app can be built in it without reading the web source.

Source of truth: `src/index.css` (tokens), `src/components/` (components).
Machine-readable form: [`tokens.json`](tokens.json).

---

## 1. What this product is, and why the design looks like this

wheretopark.sg answers one question: **where do I park, and what will it cost?**
Someone opens it in a car, often already driving, usually in Singapore
daylight, one-handed, in a hurry.

Three consequences run through every decision below:

1. **Legibility beats prettiness.** The default theme is not the soft one. It
   is `Sunlight`, tuned so every text tier and status colour clears WCAG AA on
   a screen washed out by tropical sun. If a choice trades contrast for
   elegance, the contrast wins.
2. **Numbers are the interface.** A price and a lot count are the product.
   They get the largest type on the card, tabular figures so they don't jitter
   as live data refreshes, and the most contrast available.
3. **Never fabricate a number.** Unknown price renders as `—`, not `$0.00`.
   Unknown capacity renders as "lots free", not "of 0 lots". A stale 2018 rate
   is labelled `2018 RATE` in amber. Honesty about data quality is a visible,
   designed feature — not an error state.

---

## 2. Themes

**Four preferences resolve to three palettes.** Keep those two things
separate — the preference is what the visitor picks and what you persist; the
palette is what you paint. Conflating them is the usual bug.

**No component knows a theme exists** — components only ever read semantic
tokens, which is what makes a palette addable or retunable without touching a
single component file. Preserve that property in the Android app.

### The three palettes

| Palette | Use |
|---|---|
| **Sunlight** | Highest contrast. Stays readable in direct sun. |
| **Standard** | The softer light theme. Calmer indoors. |
| **Dark** | Near-black. Less glare at night. |

### The four preferences

| Preference | Label | Resolves to |
|---|---|---|
| `auto` | Auto — *the default* | Device in dark mode → **Dark**; otherwise → **Sunlight** |
| `sunlight` | Sunlight | Sunlight |
| `light` | Standard | Standard |
| `dark` | Dark | Dark |

`auto` is the default **because most people express "I want dark mode" through
their OS setting and never open an app's settings screen.**

Two details in `auto` that are easy to get wrong:

1. **Auto's light branch is Sunlight, not Standard.** Someone who has expressed
   no preference is better served by the readable palette. Never resolve `auto`
   to the soft theme.
2. **Auto stays live.** Flipping the device theme repaints immediately — no
   reload, no app restart. On Android this means observing the configuration
   change rather than reading the setting once at startup.

An explicit pick always beats the default and does *not* track the device.
Persist the preference (the web uses `localStorage` under `psg:theme`; use
DataStore on Android) and show all four in the picker, in the order above.

### Token roles

Each theme defines the same 28 semantic tokens. Use the *role*, never the hex.

**Surfaces** — a four-step ladder from page ground to chip.

| Token | Role |
|---|---|
| `bg0` | Page ground, behind cards. Under Sunlight this is deliberately **grey**, not white: it is what makes white cards read as objects rather than white-on-white. |
| `bg1` | Card, sheet, any elevated surface. |
| `bg2` | Inset fields (the search box), recessed wells. |
| `bg3` | Chips, badges, icon tiles. |

**Lines** — two weights, both meaningful.

| Token | Role |
|---|---|
| `line` | Hairline dividers and card edges. Drawn at **0.5dp**. |
| `lineStrong` | Control outlines: inputs, chips, buttons. Kept ≥3:1 so it satisfies WCAG 1.4.11 for non-text contrast. |

**Text** — three tiers, and the third one is where most systems fail.

| Token | Role |
|---|---|
| `text1` | Primary text, hero numbers. |
| `text2` | Secondary text, supporting labels. |
| `text3` | Tertiary: addresses, source lines, placeholders, eyebrow labels. Under Sunlight this is 5.3:1 — a normal "muted grey" at ~3:1 disappears outdoors, which is the single most common accessibility bug in an app like this. |

**Status** — the availability semantics, each with a matching tint.

| Token | Meaning |
|---|---|
| `ok` / `okBg` | Lots available (>10). |
| `warn` / `warnBg` | Limited (1–10), and stale-data caveats. |
| `bad` / `badBg` | Full (0), and errors. |
| `mutedStatus` / `mutedStatusBg` | No live count. |

**Accent** — the functional colour.

| Token | Role |
|---|---|
| `accent` | Primary buttons, selected states, links, focus ring. |
| `accentOn` | Foreground on an accent fill. |
| `accentTint` | accent at 11% over `bg1` — icon tiles, soft fills. |
| `accentTintStrong` | accent at 20% over `bg1` — selected chip fill. |
| `accentBlue` / `accentBlueBg` | Links and info highlights. |

> **The accent is not the brand colour.** See §3.

**Other**

| Token | Role |
|---|---|
| `glass` | Translucent backing for chips floating over the walk map. Near-solid (94%) under Sunlight, 82% otherwise. |
| `srcHdb` / `srcUra` / `srcLta` / `srcEv` | Per-data-source chart series. |

Exact values for all three themes: [`tokens.json`](tokens.json) →
`themes.<id>.color`, and `android/kotlin/Color.kt`.

---

## 3. Brand vs. accent — the one rule people get wrong

There are two teals, and they are not interchangeable.

| | Colour | Where it may appear |
|---|---|---|
| **Brand** | `#2EE3C2` mint, → `#14C9B6` | The logo tile and wordmark. **Nowhere else.** |
| **Accent** | `#0B5C55` deep teal (Sunlight) | Every functional surface: buttons, selected chips, links, focus rings. |

The bright mint is a logo colour. It is ~1.7:1 on white — unusable as UI
colour, and it was deliberately excluded from the UI palette. Using it for a
button is the fastest way to make the Android app stop looking like
wheretopark.sg while superficially seeming on-brand.

The logo tile keeps its mint gradient in every theme. The mark never changes.

---

## 4. Typography

Two families, and only two.

| Role | Family | Use |
|---|---|---|
| Display / Body | **Plus Jakarta Sans** | Every piece of UI text, at every size. |
| Brand | **Space Grotesk** | The wordmark. Nothing else. |

Both are on Google Fonts.

### The `mono` trap

The web system has a `--font-mono` token that resolves to **Plus Jakarta Sans**
— it is not a monospace face. "Mono" names a *role*: small, uppercase,
letter-spaced metadata labels (operator badges, eyebrows, the `EST · 2 HR`
caption under a price). Substituting a real monospace font changes the look
substantially. Keep the name if it helps the two codebases share vocabulary,
but keep the family.

### Numerals

**Every numeral in the app uses tabular figures** (`tnum`). Prices and lot
counts refresh live; with proportional digits the numbers shift sideways on
every poll, which reads as instability in exactly the data users came for.

### The ladder

Sizes in sp. Half-points are deliberate — this scale was tuned optically
against real carpark names and real prices, not generated from a ratio. Do not
round them to a tidy 4sp grid: on a result card, four text tiers stack inside
about 90dp, and 12.5 vs 13 is visible.

| Style | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `hero` | 32 | 700 | −1.0 | Admin hero figure |
| `costHero` | 28 | 600 | −0.6 | **The price on a result card** |
| `total` | 26 | 700 | −0.6 | Large totals |
| `metric` | 22 | 700 | −0.5 | Dashboard metrics |
| `screenTitle` | 20 | 700 | −0.4 | Screen titles |
| `wordmark` | 19 | 700 | −0.4 | Logo (Space Grotesk) |
| `cardTitle` | 17 | 600 | −0.1 | Carpark name |
| `input` | 16 | 400 | −0.1 | Text fields — 16sp floor |
| `bodyLg` | 15 | 400 | | |
| `body` | 14 | 400 | | |
| `bodySm` | 13.5 | 500 | | Toast title, active chip |
| `label` | 13 | 500 | | |
| `caption` | 12.5 | 500 | | **The workhorse** — walk time, lot counts |
| `captionSm` | 12 | 400 | | |
| `micro` | 11.5 | 500 | | Filter pill label |
| `eyebrow` | 10.5 | 600 | +1.0, CAPS | Section labels, always `text3` |
| `badge` | 10 | 500 | +0.6 | Operator badge, EV chip, rank |
| `badgeTiny` | 9.5 | 600 | +0.6, CAPS | `CHEAPEST`, `2018 RATE` |

Negative tracking on large type and positive tracking on small caps is the
pattern. Don't invert it.

---

## 5. Shape, spacing, elevation

**Radii** — ranked by how much of the UI they carry:

| | dp | Use |
|---|---|---|
| pill | 999 | Chips, filter pills, dots, toggles |
| xl | 14 | **Cards, toasts, search field** — the default |
| lg | 12 | Inner panels, list rows |
| md | 10 | Inputs, selects, secondary buttons |
| sm | 8 | Icon tiles |
| xs | 4 | Badges |
| sheet | 22 | Bottom-sheet top corners |

**Spacing** — a 4dp grid; `8` and `12` carry most of the layout. Screen gutter
is 16dp.

**Strokes** — the hairline is **0.5dp**, and this matters more than it sounds.
It is a large part of why the UI reads as precise rather than boxy. Do not
round it to 1dp. Selected/active outlines step up to 1dp, and an active card to
1.5dp.

**Elevation** — the web shadows are soft, low-opacity and **navy-tinted**
(`#1C274C`), not black. In Compose, set `ambientColor`/`spotColor` on
`Modifier.shadow` rather than accepting the default black, or the cards look
dirty.

| | Elevation | Use |
|---|---|---|
| `sm` | 1dp | Resting card |
| `card` | 3dp | Panel |
| `raised` | 10dp | Active card, toast |
| `modal` | 20dp | Dialog |

Sunlight deliberately uses **heavier** shadows than the other two themes — a 6%
shadow is invisible outdoors. Branch on theme if you want that fidelity.

---

## 6. Components

### Card

`bg1` fill, 14dp radius, 0.5dp `line` border, 1dp elevation. Active state
(tied to a map marker): border becomes 1.5dp `accent`, elevation rises to 10dp.
The background does not change — so the card doesn't appear to jump.

### The result card — the screen the product lives on

Hierarchy, in order:

1. **Price**, 28sp, hard right. It is why the app was opened.
2. **Name**, 17sp, truncated to one line.
3. **Provenance row** above the name — rank, operator badge, EV chip, caveat
   badges — all at 10sp so it never competes with 1 and 2.
4. A 0.5dp rule, then **walk time** left, **live lots** right, both 12.5sp.

Unknowns render as `—`. Never a zero, never a guess.

### Badges

A 4dp rounded rect, `bg3` fill, hairline `lineStrong` outline, 10sp
letter-spaced text. Variants:

- **Operator** (`HDB`, `URA`, `LTA`): the default.
- **Google**: same shape, marks an unverified third-party entry.
- **2018 RATE**: amber (`warn` on `warnBg`, amber border), uppercase — a
  caveat, not an error.
- **CHEAPEST**: solid `accent` fill, `accentOn` text — the only filled badge.
- **EV chip**: bolt icon + available-port count. Three states — ≥1 available is
  accent-tinted; 0 available is muted; a stale feed is muted *and* replaces the
  number with `—` rather than showing a figure nobody can stand behind.

### Filter pill

Inactive: hairline outline, `text2`, transparent fill.
Active: 1dp `accent` outline, `accentTintStrong` fill, `accent` text.

Active state is carried by **colour and weight and border thickness** together,
deliberately — colour alone fails for colour-blind users and in bright sun.

### Duration strip

Horizontally scrolling pills for planned stay, snapping to each chip. Same
grammar as the filter pill but taller (32dp min). The whole strip is one radio
group for screen readers.

### Search field

`bg2` fill, 14dp radius, hairline `lineStrong` outline, search icon leading,
16sp input. When there's text: a round `bg3` clear button and a round `accent`
submit button appear at the trailing edge.

### Availability dot

8dp circle in the status colour. `Limited` — and only `Limited` — pulses (1.6s,
alpha to 0.55 with matching scale) and carries a 4dp halo in `warnBg`. This is
the one place motion means something rather than decorating.

### Bottom sheet

`bg0` fill, 22dp top corners, a 38×4dp `lineStrong` grab handle, scrim at
`rgba(14,16,20,0.32)`. Slides up over 260ms; the scrim fades over 180ms.
Dismissible by scrim tap and by back.

### Toast

Not a Material Snackbar. A floating card: `bg1`, 14dp radius, hairline outline,
raised shadow, a 30dp `accentTintStrong` icon tile, title at 13.5/600 and an
optional subtitle at 12/`text3`. Auto-dismisses after 2300ms, inset 16dp from
the screen edges.

### Wordmark

A gradient tile (145°, mint → teal, 10dp radius, mint glow) carrying a bold
`P`, then `wheretopark` in Space Grotesk with `.sg` dropped to `text3` at
weight 500.

---

## 7. Motion

**One easing curve carries the entire product**: `cubic-bezier(0.22, 1, 0.36, 1)`
— a fast-out, long-settle ease. Using a different curve anywhere is the
quickest way to make a screen feel like it belongs to a different app.

| Duration | ms | Use |
|---|---|---|
| micro | 120 | Colour tweaks on selection |
| fast / quick | 140 / 160 | Press feedback |
| sheet fade | 180 | Scrim |
| screen in | 220 | Screen enter (8dp rise) |
| sheet up | 260 | Bottom sheet |
| list item | 280 | List item enter (12dp rise) |
| pulse | 1600 | Limited-availability dot |
| spin | 900 | Spinner revolution |

**List stagger**: item *n* is delayed `20 + n × 40` ms, **capped at 7 items**.
The cap is load-bearing — without it the twentieth result waits 800ms and the
list reads as janky rather than polished.

### Two rules, both learned the hard way

1. **Entrance animations are transform-only.** Never animate opacity from 0 for
   a list item or screen. When a timeline is paused — an offscreen render, a
   print pass, some reduced-motion paths — opacity keyframes can leave content
   stuck permanently invisible. The visible state is the base state; only
   position animates.
2. **Reduced motion skips the animation, never the end state.** Honour the OS
   setting by disabling the pulse, the stagger and the slide — the content
   still appears, instantly.

Press feedback on rich surfaces: `brightness(0.96)` on hover/press plus a 1px
translate and 0.99 scale on press. Implemented via filter/transform rather than
a background swap, so it layers over whatever colour the element already has.

---

## 8. Accessibility — non-negotiables

These are not aspirations; several were bugs that got fixed, and the fixes are
recorded in the token values.

- **Contrast floor**: 4.5:1 for all text, 3:1 for control outlines (WCAG
  1.4.11). Under Sunlight every text tier and every status colour clears 4.5:1
  on the surface it actually sits on.
- **Touch targets**: 44dp minimum. Never ship smaller.
- **Focus ring**: 2dp `accent`, 2dp offset, for keyboard and switch-access
  users. On the web this is `!important` deliberately, because it is an
  accessibility guarantee rather than a style.
- **Status is never colour-only**: availability always pairs the dot with a
  text label; selected states pair colour with weight and border.
- **Tabular figures**, everywhere. See §4.
- Respect the OS font-scale setting. Because the ladder uses sp, this mostly
  works for free — but check the result card at 1.3× scale, where the
  price/name/badge row is tightest.

### Audited, not assumed

`tools/check-contrast.mjs` measures every text and outline token in
`tokens.json` against the surface it sits on (flattening alpha over `bg1`
first). Run it after any palette change:

```bash
node design-system/tools/check-contrast.mjs
```

Current result — **the three themes are not equally accessible, and you should
know which is which**:

| Theme | Text tokens ≥4.5:1 | Outline ≥3:1 |
|---|---|---|
| **Sunlight** | ✅ all 9 | ✅ 3.63:1 |
| **Standard** | ❌ 5 fail — `text3` 2.96, `ok` 3.42, `warn` 3.40, `accent` 3.74, `bad` 4.46 | ❌ 1.56:1 |
| **Dark** | ❌ 1 fails — `accentBlue` 3.08 | ✅ 3.12:1 |

This is not a bug introduced by the export. Standard is the *original* soft
palette, kept as an opt-in preference; Sunlight exists precisely because
Standard's tertiary text and status colours were failing outdoors, and its
token comments still record the old ratios. Ship Standard as a user choice,
never as the default, and do not treat it as an accessible baseline.

The dark theme's `accentBlue` / `accentBlueBg` pair is a genuine loose end —
those two were carried over from the light palette without being retuned for a
near-black surface. If the Android app uses `accentBlue` for link text on
`bg1`, darken it or raise its lightness until it clears 4.5:1.

---

## 9. Voice

Plain, specific, and honest about uncertainty. The interface says
`Rate unknown` rather than inventing one, `no live count` rather than `0`,
`Rates from a 2018 LTA snapshot — verify at the gantry` rather than a silent
stale number. Keep that tone in Android strings: short, lowercase-ish,
no exclamation marks, no marketing.
