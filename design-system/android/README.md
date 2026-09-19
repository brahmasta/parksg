# Android integration

Drop-in Compose implementation of the wheretopark.sg design system.

```
android/
  kotlin/
    Color.kt        ParkColors + the three palettes, all values pre-resolved
    Type.kt         Font families (Google Fonts) + the type ladder
    Dimens.kt       Radii, spacing, strokes, elevation + M3 shape/type mapping
    Theme.kt        ParkTheme composable, ParkThemeId, CompositionLocals
    Motion.kt       Easing, durations, stagger, pulse/spin helpers
    Components.kt   Card, badges, pills, toast, wordmark, result card
  res/
    drawable/       42 VectorDrawable icons (24dp, 1.75 stroke)
```

> **Not compiled.** These files were generated from the web source and have not
> been run through the Kotlin compiler. Expect to fix import paths and the
> package name on first build; the token *values* are exact.

## 1. Install

Copy `kotlin/*.kt` into your app module and change the package declaration at
the top of each file from `sg.wheretopark.design` to wherever you put them.
Copy `res/drawable/*.xml` into `app/src/main/res/drawable/`.

Dependencies:

```kotlin
implementation("androidx.compose.material3:material3:<version>")
implementation("androidx.compose.ui:ui-text-google-fonts:<version>")
```

## 2. Fonts

`Type.kt` uses **downloadable fonts** — nothing ships in the APK, and both
families come from the Google Fonts provider.

Add the certificate array at `res/values/font_certs.xml`. The
`ui-text-google-fonts` artifact documents this; the file is:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <array name="com_google_android_gms_fonts_certs">
        <item>@array/com_google_android_gms_fonts_certs_dev</item>
        <item>@array/com_google_android_gms_fonts_certs_prod</item>
    </array>
</resources>
```

with the two `..._dev` / `..._prod` string arrays copied from the
[Downloadable Fonts documentation](https://developer.android.com/develop/ui/views/text-and-emoji/downloadable-fonts).

If `R` does not resolve in `Type.kt`, add `import <your.app.package>.R`.

**To bundle instead** (offline-safe, ~300KB): download
[Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) and
[Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), put the TTFs
in `res/font/`, and replace the two `FontFamily(...)` declarations in `Type.kt`
with `FontFamily(Font(R.font.plus_jakarta_sans_regular, FontWeight.Normal), …)`.
Weights needed: 400, 500, 600, 700, 800 for Jakarta; 500, 600, 700 for Grotesk.

## 3. Use

```kotlin
@Composable
fun App() {
    // Persist the user's pick (DataStore). Default is Sunlight — deliberately
    // NOT the system light/dark setting. See DESIGN_SYSTEM.md §2.
    val themeId by settings.themeId.collectAsState(ParkThemeId.Sunlight)

    ParkTheme(themeId) {
        Surface(color = ParkTheme.colors.bg0) { /* … */ }
    }
}
```

Inside any composable:

```kotlin
Text("12 lots", style = ParkTheme.type.caption, color = ParkTheme.colors.ok)

CarparkCard(
    rank = 1,
    name = "Marina Bay Sands",
    block = "10 Bayfront Ave",
    priceLabel = "$12.00",
    priceCaption = "Est · 2 hr",
    walkMinutes = 4,
    walkDistanceLabel = "310m",
    lotsLabel = "243 lots",
    availability = availabilityOf(243),
    walkIcon = R.drawable.ic_walk,
    operator = "URA",
    isCheapest = true,
    onClick = { /* … */ },
)
```

### System bars

Match the status bar to the active theme, mirroring the web's
`<meta name="theme-color">`:

```kotlin
val view = LocalView.current
val themeId = /* active */
SideEffect {
    val window = (view.context as Activity).window
    window.statusBarColor = themeId.systemBarColor.toArgb()
    WindowCompat.getInsetsController(window, view)
        .isAppearanceLightStatusBars = !themeId.colors.isDark
}
```

Status bar colours: Sunlight `#EEF1F5`, Standard `#FAFAFA`, Dark `#12151A`.

### Reduced motion

`Motion.kt` reads `LocalReduceMotion`, which defaults to `false`. Wire it up at
app start:

```kotlin
val reduce = Settings.Global.getFloat(
    context.contentResolver,
    Settings.Global.ANIMATOR_DURATION_SCALE,
    1f,
) == 0f

CompositionLocalProvider(LocalReduceMotion provides reduce) { ParkTheme { … } }
```

## 4. Icons

42 stroke icons, converted from `src/components/icons.tsx`. All are 24dp
viewport, `strokeWidth 1.75`, round caps and joins, `#FF000000` stroke so
`Icon(tint = …)` recolours them cleanly.

```
ic_arrow_right   ic_bolt        ic_bookmark     ic_briefcase   ic_building
ic_calendar      ic_car         ic_check        ic_chevron_down
ic_chevron_left  ic_chevron_right ic_clock      ic_close       ic_cloud
ic_contrast      ic_database    ic_device       ic_external    ic_heart
ic_history       ic_home        ic_info         ic_layers      ic_list
ic_location      ic_map         ic_minus        ic_moon        ic_navigate
ic_pin           ic_plus        ic_refresh      ic_search      ic_share
ic_shield        ic_sign_out    ic_star         ic_sun         ic_trash
ic_user          ic_walk        ic_warning
```

To vary stroke weight (the web uses 1.75 / 2 / 2.25 / 2.5 in places), duplicate
the drawable and change `android:strokeWidth`.

`ic_bookmark` has a filled variant on the web (saved state); here it is the
outline. For the filled state, copy it and swap `android:strokeColor` for
`android:fillColor`.

**Not included**: the Google "G", Google Maps, Waze and Apple Maps marks. Those
are third-party brand assets — use each vendor's official Android asset under
their brand guidelines.

To regenerate after the web icons change, re-run the converter described in
`../tools/icons-to-vector-drawable.mjs`.
