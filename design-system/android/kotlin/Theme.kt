package sg.wheretopark.design

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * A palette that can actually be painted — the Android equivalent of the web's
 * `data-theme` attribute on <html>.
 *
 * There are three of these and four [ParkThemePref] values. Keep the two
 * apart: the preference is what the user picks and what you persist, the
 * palette is what you paint.
 */
enum class ParkThemeId(val label: String, val blurb: String) {
    Sunlight("Sunlight", "Highest contrast — stays readable in direct sun."),
    Standard("Standard", "The softer light theme. Easier on the eyes indoors."),
    Dark("Dark", "Near-black. Less glare at night.");

    val colors: ParkColors
        get() = when (this) {
            Sunlight -> SunlightColors
            Standard -> StandardColors
            Dark -> DarkColors
        }

    /** Colour for the system status bar / navigation bar scrim. */
    val systemBarColor: Color
        get() = colors.bg0
}

/**
 * What the visitor chose. This is the value to persist (DataStore), show in
 * the picker, and pass to [ParkTheme] — never the resolved [ParkThemeId].
 *
 * [Auto] is the default, because most people express "I want dark mode"
 * through their OS setting and never open an app's settings screen.
 */
enum class ParkThemePref(val label: String, val blurb: String, val iconRes: String) {
    Auto("Auto", "Follows your device — dark at night if your phone is set that way.", "ic_device"),
    Sunlight("Sunlight", "Highest contrast — stays readable in direct sun.", "ic_contrast"),
    Standard("Standard", "The softer light theme. Easier on the eyes indoors.", "ic_sun"),
    Dark("Dark", "Near-black. Less glare at night.", "ic_moon");

    /**
     * Resolve to the palette to paint.
     *
     * Note the light branch: `Auto` falls back to **Sunlight**, not Standard.
     * Someone who has expressed no preference is better served by the readable
     * palette, and getting this wrong is the single easiest way to ship the
     * low-contrast theme to most of your users.
     *
     * This is @Composable and reads [isSystemInDarkTheme], so `Auto` stays
     * live: a device theme change recomposes and repaints immediately, with no
     * restart. Do not hoist the result into a ViewModel — that freezes it.
     */
    @Composable
    fun resolve(): ParkThemeId = when (this) {
        Auto -> if (isSystemInDarkTheme()) ParkThemeId.Dark else ParkThemeId.Sunlight
        Sunlight -> ParkThemeId.Sunlight
        Standard -> ParkThemeId.Standard
        Dark -> ParkThemeId.Dark
    }
}

val LocalParkColors = staticCompositionLocalOf { SunlightColors }
val LocalParkType = staticCompositionLocalOf { ParkType }
val LocalParkDimens = staticCompositionLocalOf { ParkDimens }

/**
 * Token accessors. Components read `ParkTheme.colors.accent`, never a literal.
 *
 * This is the whole trick behind the web system's "no component knows a theme
 * exists": a theme can be added or retuned without touching a single
 * composable.
 */
object ParkTheme {
    val colors: ParkColors
        @Composable @ReadOnlyComposable get() = LocalParkColors.current

    val type: ParkTypography
        @Composable @ReadOnlyComposable get() = LocalParkType.current

    val dimens: ParkDimensions
        @Composable @ReadOnlyComposable get() = LocalParkDimens.current
}

/**
 * Wrap the app in this.
 *
 * Takes an already-resolved palette. Prefer the [ParkThemePref] overload
 * below, which resolves the user's preference and keeps `Auto` live.
 *
 * @param themeId the palette to paint.
 */
@Composable
fun ParkTheme(
    themeId: ParkThemeId = ParkThemeId.Sunlight,
    content: @Composable () -> Unit,
) {
    val colors = themeId.colors

    // Material 3 is mapped underneath so that stock M3 components (TextField,
    // Snackbar, ripples, date pickers) land on-brand without being restyled
    // one by one. App surfaces should still use ParkTheme.colors directly.
    val material = if (colors.isDark) {
        darkColorScheme(
            primary = colors.accent,
            onPrimary = colors.accentOn,
            primaryContainer = colors.accentTintStrong,
            onPrimaryContainer = colors.accent,
            secondary = colors.accentBlue,
            onSecondary = Color.White,
            background = colors.bg0,
            onBackground = colors.text1,
            surface = colors.bg1,
            onSurface = colors.text1,
            surfaceVariant = colors.bg2,
            onSurfaceVariant = colors.text2,
            outline = colors.lineStrong,
            outlineVariant = colors.line,
            error = colors.bad,
            onError = Color.White,
            errorContainer = colors.badBg,
            onErrorContainer = colors.bad,
        )
    } else {
        lightColorScheme(
            primary = colors.accent,
            onPrimary = colors.accentOn,
            primaryContainer = colors.accentTintStrong,
            onPrimaryContainer = colors.accent,
            secondary = colors.accentBlue,
            onSecondary = Color.White,
            background = colors.bg0,
            onBackground = colors.text1,
            surface = colors.bg1,
            onSurface = colors.text1,
            surfaceVariant = colors.bg2,
            onSurfaceVariant = colors.text2,
            outline = colors.lineStrong,
            outlineVariant = colors.line,
            error = colors.bad,
            onError = Color.White,
            errorContainer = colors.badBg,
            onErrorContainer = colors.bad,
        )
    }

    CompositionLocalProvider(
        LocalParkColors provides colors,
        LocalParkType provides ParkType,
        LocalParkDimens provides ParkDimens,
    ) {
        MaterialTheme(
            colorScheme = material,
            typography = material3Typography(),
            shapes = ParkShapes,
            content = content,
        )
    }
}

/**
 * The entry point you almost certainly want: pass the stored *preference* and
 * let it resolve. Because [ParkThemePref.resolve] reads the system setting
 * inside composition, `Auto` tracks the device live.
 *
 * ```kotlin
 * val pref by settings.themePref.collectAsState(ParkThemePref.Auto)
 * ParkTheme(pref) { … }
 * ```
 */
@Composable
fun ParkTheme(
    pref: ParkThemePref,
    content: @Composable () -> Unit,
) = ParkTheme(themeId = pref.resolve(), content = content)
