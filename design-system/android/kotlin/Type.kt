package sg.wheretopark.design

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.Font as GoogleFont
import androidx.compose.ui.text.googlefonts.GoogleFont as GoogleFontName
import androidx.compose.ui.text.googlefonts.GoogleFont.Provider
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/*
 * Typography.
 *
 * Two families, and only two:
 *   Plus Jakarta Sans — every piece of UI text, at every size.
 *   Space Grotesk     — the wordmark, and nothing else.
 *
 * Both are on Google Fonts, so they can be pulled via downloadable fonts (no
 * APK weight) or bundled as .ttf in res/font. The downloadable path is set up
 * below; see android/README.md for the manifest + certs wiring, and for the
 * bundled fallback if you would rather ship them.
 *
 * NOTE ON `Mono`: the web system has a --font-mono token that is NOT a
 * monospace face — it resolves to Plus Jakarta Sans too. "Mono" there names a
 * ROLE: small, uppercase, letter-spaced metadata labels (operator badges,
 * eyebrows, the EST caption under a price). It is kept as [ParkFonts.Mono]
 * here so the vocabulary matches the web codebase, but do not substitute a
 * real monospace font for it — that would change the look.
 */

// `R` here is your app module's R class. If your package is not
// sg.wheretopark.design, add `import <your.app.package>.R` above. The certs
// array ships with the androidx.compose.ui:ui-text-google-fonts artifact —
// see android/README.md for the one-line res/values entry it needs.
private val provider = Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs,
)

private val jakartaName = GoogleFontName("Plus Jakarta Sans")
private val grotestkName = GoogleFontName("Space Grotesk")

val PlusJakartaSans = FontFamily(
    GoogleFont(jakartaName, provider, FontWeight.Normal),
    GoogleFont(jakartaName, provider, FontWeight.Medium),
    GoogleFont(jakartaName, provider, FontWeight.SemiBold),
    GoogleFont(jakartaName, provider, FontWeight.Bold),
    GoogleFont(jakartaName, provider, FontWeight.ExtraBold),
)

val SpaceGrotesk = FontFamily(
    GoogleFont(grotestkName, provider, FontWeight.Medium),
    GoogleFont(grotestkName, provider, FontWeight.SemiBold),
    GoogleFont(grotestkName, provider, FontWeight.Bold),
)

object ParkFonts {
    val Display = PlusJakartaSans
    val Body = PlusJakartaSans

    /** The metadata-label role. Same family — see the note above. */
    val Mono = PlusJakartaSans

    /** Wordmark only. */
    val Brand = SpaceGrotesk
}

/**
 * The type ladder.
 *
 * Half-point sizes are deliberate: this scale was tuned optically against real
 * carpark names and real prices, not generated from a ratio. Do not round them
 * to a tidy 4sp grid — 12.5sp vs 13sp is a visible difference on a result card
 * where four text tiers stack inside 90dp.
 *
 * Every style carries tabular figures. Prices and lot counts refresh live; with
 * proportional digits the numbers jitter sideways on every poll.
 */
@Immutable
data class ParkTypography(
    /** Admin hero figure. */
    val hero: TextStyle,
    /** The price on a result card — the most important number in the product. */
    val costHero: TextStyle,
    val total: TextStyle,
    val metric: TextStyle,
    val screenTitle: TextStyle,
    val wordmark: TextStyle,
    /** Carpark name. */
    val cardTitle: TextStyle,
    /** Text inputs. 16sp floor — smaller reads badly in sun. */
    val input: TextStyle,
    val bodyLg: TextStyle,
    val body: TextStyle,
    /** Toast title, active chip label. */
    val bodySm: TextStyle,
    val label: TextStyle,
    /** The workhorse: walk time, lot counts, card metadata. */
    val caption: TextStyle,
    val captionSm: TextStyle,
    /** Filter pill label. */
    val micro: TextStyle,
    /** Section labels. Always uppercase, always text3. */
    val eyebrow: TextStyle,
    /** Operator badge, EV chip, rank. */
    val badge: TextStyle,
    /** CHEAPEST pill, 2018 RATE pill. */
    val badgeTiny: TextStyle,
)

private fun park(
    size: Double,
    weight: FontWeight,
    tracking: Double = 0.0,
    family: FontFamily = ParkFonts.Body,
    lineHeightMultiplier: Double? = null,
) = TextStyle(
    fontFamily = family,
    fontSize = size.sp,
    fontWeight = weight,
    letterSpacing = tracking.sp,
    lineHeight = lineHeightMultiplier?.let { (size * it).sp } ?: TextUnit.Unspecified,
    // Tabular figures: prices and lot counts refresh live, and proportional
    // digits make the numbers jitter sideways on every poll.
    fontFeatureSettings = "tnum",
)

val ParkType = ParkTypography(
    hero = park(32.0, FontWeight.Bold, -1.0, ParkFonts.Display, 1.0),
    costHero = park(28.0, FontWeight.SemiBold, -0.6, ParkFonts.Display, 1.0),
    total = park(26.0, FontWeight.Bold, -0.6, ParkFonts.Display, 1.0),
    metric = park(22.0, FontWeight.Bold, -0.5, ParkFonts.Display, 1.0),
    screenTitle = park(20.0, FontWeight.Bold, -0.4, ParkFonts.Display),
    wordmark = park(19.0, FontWeight.Bold, -0.4, ParkFonts.Brand),
    cardTitle = park(17.0, FontWeight.SemiBold, -0.1, ParkFonts.Display, 1.15),
    input = park(16.0, FontWeight.Normal, -0.1),
    bodyLg = park(15.0, FontWeight.Normal),
    body = park(14.0, FontWeight.Normal),
    bodySm = park(13.5, FontWeight.Medium),
    label = park(13.0, FontWeight.Medium),
    caption = park(12.5, FontWeight.Medium),
    captionSm = park(12.0, FontWeight.Normal),
    micro = park(11.5, FontWeight.Medium),
    eyebrow = park(10.5, FontWeight.SemiBold, 1.0, ParkFonts.Mono),
    badge = park(10.0, FontWeight.Medium, 0.6, ParkFonts.Mono),
    badgeTiny = park(9.5, FontWeight.SemiBold, 0.6, ParkFonts.Mono),
)
