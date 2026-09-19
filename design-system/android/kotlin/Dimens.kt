package sg.wheretopark.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Shape, spacing and elevation.
 *
 * Radii come from what the web app actually uses, ranked by frequency: the
 * pill (999) and 14/12/10 carry almost everything. A carpark card is 14,
 * a chip is a pill, a small badge is 4.
 */
@Immutable
data class ParkDimensions(
    // ── Radii ──────────────────────────────────────────────────────────
    /** Badges: operator, EV chip, CHEAPEST. */
    val radiusXs: Dp = 4.dp,
    /** Toast icon tile, small squares. */
    val radiusSm: Dp = 8.dp,
    /** Inputs, selects, secondary buttons. */
    val radiusMd: Dp = 10.dp,
    /** Inner panels, list rows. */
    val radiusLg: Dp = 12.dp,
    /** Cards, toasts, search field — the default card radius. */
    val radiusXl: Dp = 14.dp,
    /** Large panels. */
    val radiusXxl: Dp = 16.dp,
    /** Bottom sheet top corners. */
    val radiusSheet: Dp = 22.dp,
    /** Fully rounded. */
    val radiusPill: Dp = 999.dp,

    // ── Spacing (4dp grid) ─────────────────────────────────────────────
    val spaceXxs: Dp = 2.dp,
    val spaceXs: Dp = 4.dp,
    val spaceSm: Dp = 6.dp,
    /** The most common gap in the app. */
    val spaceMd: Dp = 8.dp,
    /** The second most common. */
    val spaceLg: Dp = 12.dp,
    val spaceXl: Dp = 16.dp,
    val spaceXxl: Dp = 20.dp,
    val spaceXxxl: Dp = 24.dp,
    /** Left/right screen padding. */
    val screenGutter: Dp = 16.dp,

    // ── Strokes ────────────────────────────────────────────────────────
    /**
     * The hairline. 0.5dp is deliberate and is a large part of why the UI
     * reads as precise rather than boxy — do not round it up to 1dp. On a
     * 1x-density display it may render as a faint 1px line; that is fine.
     */
    val hairline: Dp = 0.5.dp,
    /** Selected / active outline. */
    val strokeActive: Dp = 1.dp,
    /** Card outline when the card is the active one (desktop hover parity). */
    val strokeActiveStrong: Dp = 1.5.dp,

    // ── Elevation ──────────────────────────────────────────────────────
    /**
     * The web shadows are soft, low-opacity and navy-tinted; Compose can only
     * approximate them with elevation, so pair these with an ambient/spot
     * colour (see [shadowColor]) rather than the default pure black.
     *
     * Sunlight deliberately uses heavier shadows than the other two themes —
     * a 6% shadow is invisible outdoors. If you want that fidelity, branch on
     * `ParkTheme.colors.isDark` / theme id when choosing these.
     */
    val elevationSm: Dp = 1.dp,
    val elevationCard: Dp = 3.dp,
    val elevationRaised: Dp = 10.dp,
    val elevationModal: Dp = 20.dp,

    // ── Touch ──────────────────────────────────────────────────────────
    /** Floor for anything tappable. Never ship a smaller target. */
    val minTouchTarget: Dp = 44.dp,
    /** Focus ring for keyboard / switch-access users. */
    val focusRingWidth: Dp = 2.dp,
    val focusRingOffset: Dp = 2.dp,
)

val ParkDimens = ParkDimensions()

/**
 * Shadow tint. The web shadows are navy, not black — `rgba(28,39,76,…)` in the
 * light themes and a deeper `rgba(20,30,60,…)` under Sunlight. Pass this as
 * both `ambientColor` and `spotColor` on `Modifier.shadow`.
 */
object ParkShadow {
    val Navy = androidx.compose.ui.graphics.Color(0xFF1C274C)
    val NavyDeep = androidx.compose.ui.graphics.Color(0xFF141E3C)
}

/** Material 3 shape mapping, so stock M3 surfaces inherit the radii. */
val ParkShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(22.dp),
)

/**
 * Material 3 typography mapped onto the ladder, so stock M3 components pick up
 * Plus Jakarta Sans and the right weights. App code should prefer
 * `ParkTheme.type.*` directly — this exists so a `Snackbar` or an
 * `OutlinedTextField` does not fall back to Roboto.
 */
fun material3Typography(): Typography = Typography(
    displayLarge = ParkType.hero,
    displayMedium = ParkType.total,
    displaySmall = ParkType.metric,
    headlineLarge = ParkType.total,
    headlineMedium = ParkType.metric,
    headlineSmall = ParkType.screenTitle,
    titleLarge = ParkType.screenTitle,
    titleMedium = ParkType.cardTitle,
    titleSmall = ParkType.label,
    bodyLarge = ParkType.bodyLg,
    bodyMedium = ParkType.body,
    bodySmall = ParkType.captionSm,
    labelLarge = ParkType.label,
    labelMedium = ParkType.caption,
    labelSmall = ParkType.micro,
)
