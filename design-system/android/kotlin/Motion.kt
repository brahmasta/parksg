package sg.wheretopark.design

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State

/**
 * Motion.
 *
 * One easing curve carries the entire product — a fast-out, long-settle ease
 * that makes a 220ms transition feel immediate but not abrupt. Using a
 * different curve anywhere is the quickest way to make a screen feel like it
 * belongs to a different app.
 *
 * TWO RULES, both learned the hard way on the web:
 *
 *  1. Entrance animations are TRANSFORM-ONLY. Never animate opacity from 0 for
 *     a list item or a screen. When an animation timeline is paused — an
 *     offscreen render, a print/PDF pass, some reduced-motion paths — opacity
 *     keyframes can leave content stuck permanently invisible. The visible
 *     state is the base state; only position animates.
 *
 *  2. Honour the OS reduce-motion setting by skipping the animation, never the
 *     end state. See [reduceMotion].
 */
object ParkMotion {
    /** The one curve. Roughly easeOutQuint. */
    val Standard: Easing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
    val Linear: Easing = LinearEasing

    /** Colour/opacity tweaks on press and hover. */
    const val DurationMicro = 120
    const val DurationFast = 140
    const val DurationQuick = 160

    /** Sheet scrim fade-in. */
    const val DurationSheetFade = 180

    /** Screen enter, and the toast. */
    const val DurationScreen = 220

    /** Bottom sheet slide-up. */
    const val DurationSheet = 260

    /** A single list item's slide-up. */
    const val DurationListItem = 280

    /** Limited-availability dot pulse (one full cycle). */
    const val DurationPulse = 1600

    /** Spinner revolution. */
    const val DurationSpin = 900

    /** Distance a list item travels on entry, in dp. */
    const val ListItemEnterOffsetDp = 12f

    /** Distance a screen travels on entry, in dp. */
    const val ScreenEnterOffsetDp = 8f

    /**
     * Stagger for a list: the nth child is delayed by
     * `FirstDelay + n * Step`, capped at [StaggerMaxChildren].
     *
     * The cap matters. Without it, the twentieth result in a long list waits
     * 800ms before appearing, which reads as jank rather than polish.
     */
    const val StaggerFirstDelayMs = 20
    const val StaggerStepMs = 40
    const val StaggerMaxChildren = 7

    fun staggerDelayMs(index: Int): Int =
        StaggerFirstDelayMs + minOf(index, StaggerMaxChildren - 1) * StaggerStepMs
}

/**
 * True when the user has asked the system to reduce motion.
 *
 * Compose has no first-class API for this, so read
 * `Settings.Global.ANIMATOR_DURATION_SCALE` — 0 means animations are off.
 * Wire this to your own provider at app start; the default here is a safe
 * `false` so nothing silently disappears if the lookup is missing.
 */
val LocalReduceMotion = androidx.compose.runtime.staticCompositionLocalOf { false }

@Composable
fun reduceMotion(): Boolean = LocalReduceMotion.current

/**
 * The spinner's rotation, matching the web's 900ms linear revolution.
 * Returns a steady 0f when motion is reduced.
 */
@Composable
fun rememberSpinRotation(): State<Float> {
    val transition = rememberInfiniteTransition(label = "park-spin")
    return transition.animateFloat(
        initialValue = 0f,
        targetValue = if (reduceMotion()) 0f else 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(ParkMotion.DurationSpin, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "park-spin-angle",
    )
}

/**
 * The limited-availability dot pulse: alpha 1 → 0.55 → 1 with a matching
 * scale, over 1.6s. Returns a flat 1f when motion is reduced — the dot stays,
 * only the pulse goes.
 */
@Composable
fun rememberPulse(): State<Float> {
    val transition = rememberInfiniteTransition(label = "park-pulse")
    return transition.animateFloat(
        initialValue = 1f,
        targetValue = if (reduceMotion()) 1f else 0.55f,
        animationSpec = infiniteRepeatable(
            animation = tween(ParkMotion.DurationPulse / 2, easing = ParkMotion.Standard),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "park-pulse-alpha",
    )
}
