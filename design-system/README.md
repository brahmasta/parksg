# wheretopark.sg — Design System Export

A self-contained export of the wheretopark.sg design system, prepared for
building the Android app in **Google AI Studio**.

```
design-system/
  README.md              ← you are here
  AI_STUDIO_BRIEF.md     ← paste this into AI Studio as the context prompt
  DESIGN_SYSTEM.md       ← the full spec: tokens, type, components, motion, a11y
  tokens.json            ← machine-readable tokens, all three themes
  android/
    README.md            ← integration steps: install, fonts, system bars, icons
    kotlin/              ← drop-in Compose theme + components (6 files)
    res/drawable/        ← 42 VectorDrawable icons
  tools/
    icons-to-vector-drawable.mjs   ← regenerates the icons from the web source
    check-contrast.mjs             ← audits every token against WCAG
```

## Using it

1. Open `AI_STUDIO_BRIEF.md`, copy the part below the rule, and paste it into
   AI Studio as the system/context prompt.
2. Attach `tokens.json`, `DESIGN_SYSTEM.md` and the `android/` folder.
3. If only one file can be attached, attach `tokens.json` — it is
   self-describing.

## The short version

If you read nothing else:

- **Four preferences, three palettes.** `Auto` is the default and resolves to
  Dark on a dark device, **Sunlight** otherwise — never Standard. Persist the
  preference, not the resolved palette, and keep Auto live.
- **Two teals.** `#2EE3C2` mint is the logo, and only the logo. `accent`
  (`#0B5C55` under Sunlight) is every functional surface.
- **Plus Jakarta Sans** for all UI, **Space Grotesk** for the wordmark only.
  The `mono` token is *not* monospace — it is a small-caps label role.
- **Tabular figures everywhere.** Live prices must not jitter.
- **Hairlines are 0.5dp**, and this matters.
- **Never fabricate a number.** Unknown renders as `—`.
- **One easing curve**: `cubic-bezier(0.22, 1, 0.36, 1)`.

## Regenerating

Run from the repository root.

```bash
node design-system/tools/icons-to-vector-drawable.mjs src/components/icons.tsx design-system/android/res/drawable
```

```bash
node design-system/tools/check-contrast.mjs
```

The colour tokens themselves are transcribed from `src/index.css` by hand —
several are `color-mix()` or `rgba()` on the web and are pre-resolved here,
since Android cannot evaluate them. If `src/index.css` changes, update
`tokens.json` and `android/kotlin/Color.kt` together, then re-run the contrast
check.

## What is not in here

- **Third-party brand marks** (Google "G", Google Maps, Waze, Apple Maps).
  Use each vendor's official Android asset under their brand guidelines.
- **Map styling.** The web mutes the OneMap basemap with a `saturate(0.85)`
  filter and reduced tile opacity so the coloured price pins read clearly. The
  Android equivalent depends on which map SDK the app uses.
- **The desktop shell.** Everything here is the phone flow, which is what the
  Android app needs.
- **Compiled Kotlin.** The files in `android/kotlin/` were generated from the
  web source and have not been run through the Kotlin compiler — expect to fix
  the package name and a few imports on first build. The token *values* are
  exact, and the icons were rendered and visually verified.
