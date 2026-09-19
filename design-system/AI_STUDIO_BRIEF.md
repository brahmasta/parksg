# Paste-ready brief for Google AI Studio

Copy everything below the line into AI Studio as your system/context prompt,
and attach `tokens.json`, `DESIGN_SYSTEM.md` and the `android/` folder.

If you can only attach one file, attach `tokens.json` — it is self-describing.

---

You are building an **Android app** (Kotlin + Jetpack Compose, Material 3) for
**wheretopark.sg**, a Singapore parking app that answers one question: *where
do I park, and what will it cost?* It must look and feel like the existing web
app, whose design system is attached.

## Hard rules — do not deviate

1. **Use the provided theme files.** `android/kotlin/` contains `Color.kt`,
   `Type.kt`, `Theme.kt`, `Dimens.kt`, `Motion.kt` and `Components.kt`. Wrap
   the app in `ParkTheme { }` and read every colour, size and text style from
   `ParkTheme.colors`, `ParkTheme.dimens`, `ParkTheme.type`. **Never write a
   literal colour, a literal sp size, or `MaterialTheme.colorScheme.*` in app
   code.**

2. **Four preferences, three palettes.** The picker offers Auto / Sunlight /
   Standard / Dark; the palettes are Sunlight, Standard, Dark. **`Auto` is the
   default**, and it resolves to Dark when the device is in dark mode and to
   **Sunlight** otherwise — never to Standard. Auto must stay live: flipping
   the device theme repaints immediately. Persist the *preference* (DataStore),
   not the resolved palette. `ParkThemePref.resolve()` in `Theme.kt` does this;
   use it rather than calling `isSystemInDarkTheme()` yourself.

3. **Do not use Material You / dynamic colour.** The palette is
   contrast-engineered; device wallpaper colours would destroy it.

4. **Two teals, not interchangeable.** `ParkBrand.Brand` (#2EE3C2 mint) is for
   the logo only — it is ~1.7:1 on white. Everything functional uses
   `ParkTheme.colors.accent`.

5. **Fonts: Plus Jakarta Sans for all UI, Space Grotesk for the wordmark only.**
   Both via Google Fonts. Note that the `mono` token is *not* a monospace face
   — it is the small-uppercase-label role, in Plus Jakarta Sans. Do not
   substitute a monospace font.

6. **Tabular figures on every numeral** (`fontFeatureSettings = "tnum"`),
   already set in `Type.kt`. Live-refreshing prices must not jitter.

7. **Never fabricate data.** Unknown price → `—`, never `$0.00`. Unknown
   capacity → "lots free", never "of 0 lots". Stale rates → the amber
   `2018 RATE` badge. This is a designed product feature, not an error state.

8. **Hairlines are 0.5dp.** Not 1dp. This is a large part of the visual
   identity.

9. **One easing curve**: `ParkMotion.Standard` =
   `CubicBezierEasing(0.22f, 1f, 0.36f, 1f)`. Use it for every transition.

10. **Entrance animations are transform-only** — never animate opacity from 0,
    or paused timelines can leave content permanently invisible. Honour reduced
    motion by skipping the animation, never the end state.

11. **Accessibility floors**: 44dp touch targets, 4.5:1 text contrast, 3:1
    control outlines, status never conveyed by colour alone (always pair the
    availability dot with its text label).

## Icons

`android/res/drawable/` contains 42 VectorDrawables converted from the web
icon set — 24dp, 1.75 stroke width, round caps and joins, all stroke-based so
they tint cleanly. Use these rather than Material Symbols; the line weight and
corner character are part of the identity.

Where the set has no icon for something you need, draw a new one in the same
grammar: 24×24 viewport, 1.75 stroke, round caps, no fills.

Brand marks (Google, Google Maps, Waze, Apple Maps) are deliberately **not**
included — use each vendor's official Android asset, subject to their brand
guidelines.

## Screens to build

Mirror the web information architecture:

- **Home** — wordmark, search field ("Where to?"), duration strip, saved
  destination chips, recent searches.
- **Results** — a scrolling list of carpark cards over/beside a map, with
  filter pills (Available only, EV) and a map/list toggle. The cheapest result
  carries the `CHEAPEST` badge.
- **Detail** — the carpark: live lots, rate table, walk map, and a primary
  "Navigate" CTA opening the user's maps app.
- **Saved** — bookmarked carparks and destinations.
- **Account** — sign-in, theme picker, about.

## Build it in this order

1. Drop in `android/kotlin/` and `android/res/`, wire the fonts (see
   `android/README.md`), and get `ParkTheme` compiling.
2. Build a preview screen showing `CarparkCard`, `FilterPill`, `DurationChip`,
   `ParkToast`, `AvailabilityDot` and `Wordmark` in all three themes. Compare
   it against `DESIGN_SYSTEM.md` §6 before going further — getting the card
   right is 80% of looking like this product.
3. Then build the screens.

Read `DESIGN_SYSTEM.md` for the reasoning behind any rule you're tempted to
break. Most of them were bugs once.
