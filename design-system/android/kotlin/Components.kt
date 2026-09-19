package sg.wheretopark.design

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.graphicsLayer
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * The components that make the product recognisable.
 *
 * This is not an exhaustive widget library — it is the handful of pieces that
 * carry wheretopark.sg's identity, written so the rest of the app can be built
 * in the same language. Everything reads tokens from ParkTheme; nothing here
 * contains a literal colour or size.
 */

/* ── Availability ─────────────────────────────────────────────────────── */

/**
 * The four availability states, and the rule that produces them from a live
 * lot count. This mapping is product logic, not decoration — keep it identical
 * to the web (src/lib/availability.ts) or the two clients will disagree about
 * what "limited" means.
 */
enum class Availability { Available, Limited, Full, Unknown }

fun availabilityOf(lots: Int?): Availability = when {
    lots == null -> Availability.Unknown
    lots == 0 -> Availability.Full
    lots <= 10 -> Availability.Limited
    else -> Availability.Available
}

@Composable
fun Availability.color(): Color = when (this) {
    Availability.Available -> ParkTheme.colors.ok
    Availability.Limited -> ParkTheme.colors.warn
    Availability.Full -> ParkTheme.colors.bad
    Availability.Unknown -> ParkTheme.colors.mutedStatus
}

@Composable
fun Availability.backgroundColor(): Color = when (this) {
    Availability.Available -> ParkTheme.colors.okBg
    Availability.Limited -> ParkTheme.colors.warnBg
    Availability.Full -> ParkTheme.colors.badBg
    Availability.Unknown -> ParkTheme.colors.mutedStatusBg
}

/**
 * The status dot. `Limited` pulses and carries a soft halo — the one place in
 * the app where motion is used to mean something rather than to decorate.
 */
@Composable
fun AvailabilityDot(
    status: Availability,
    modifier: Modifier = Modifier,
    size: Dp = 8.dp,
) {
    val pulsing = status == Availability.Limited
    val pulse = if (pulsing) rememberPulse().value else 1f
    val halo = status.backgroundColor()

    Box(
        modifier = modifier.size(if (pulsing) size + 8.dp else size),
        contentAlignment = Alignment.Center,
    ) {
        if (pulsing) {
            Box(
                Modifier
                    .size(size + 8.dp)
                    .graphicsLayer { alpha = pulse }
                    .background(halo, RoundedCornerShape(percent = 50)),
            )
        }
        Box(
            Modifier
                .size(size)
                .graphicsLayer {
                    alpha = pulse
                    scaleX = pulse
                    scaleY = pulse
                }
                .background(status.color(), RoundedCornerShape(percent = 50)),
        )
    }
}

/* ── Surfaces ─────────────────────────────────────────────────────────── */

/**
 * The card. One radius (14dp), one hairline border, one soft shadow.
 *
 * `active` is the selected/hovered state used when a card is tied to a map
 * marker: the border thickens to accent and the elevation lifts. Nothing else
 * changes — the background stays put, so the card does not appear to jump.
 */
@Composable
fun ParkCard(
    modifier: Modifier = Modifier,
    active: Boolean = false,
    onClick: (() -> Unit)? = null,
    shape: Shape = RoundedCornerShape(ParkTheme.dimens.radiusXl),
    content: @Composable () -> Unit,
) {
    val c = ParkTheme.colors
    val d = ParkTheme.dimens

    Box(
        modifier
            .fillMaxWidth()
            .shadow(
                elevation = if (active) d.elevationRaised else d.elevationSm,
                shape = shape,
                ambientColor = ParkShadow.Navy,
                spotColor = ParkShadow.Navy,
            )
            .background(c.bg1, shape)
            .border(
                width = if (active) d.strokeActiveStrong else d.hairline,
                color = if (active) c.accent else c.line,
                shape = shape,
            )
            .clip(shape)
            .then(
                if (onClick != null) {
                    Modifier
                        .clickable(role = Role.Button, onClick = onClick)
                        .defaultMinSize(minHeight = d.minTouchTarget)
                } else {
                    Modifier
                }
            ),
    ) { content() }
}

/** The 0.5dp rule used inside cards and between list rows. */
@Composable
fun ParkDivider(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(ParkTheme.dimens.hairline)
            .background(ParkTheme.colors.line),
    )
}

/* ── Labels and badges ────────────────────────────────────────────────── */

/** Section label. Uppercase, letter-spaced, always the tertiary text tier. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        style = ParkTheme.type.eyebrow,
        color = ParkTheme.colors.text3,
        modifier = modifier,
    )
}

/**
 * The generic small badge: a 4dp rounded rect with a hairline outline.
 * Operator marks (HDB, URA, LTA), the Google provenance chip and the stale
 * rate warning are all this shape at different weights.
 */
@Composable
fun ParkBadge(
    text: String,
    modifier: Modifier = Modifier,
    textColor: Color = ParkTheme.colors.text2,
    background: Color = ParkTheme.colors.bg3,
    borderColor: Color = ParkTheme.colors.lineStrong,
    emphasised: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(ParkTheme.dimens.radiusXs)
    Row(
        modifier
            .background(background, shape)
            .border(ParkTheme.dimens.hairline, borderColor, shape)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        leadingIcon?.invoke()
        Text(
            text = if (emphasised) text.uppercase() else text,
            style = if (emphasised) ParkTheme.type.badgeTiny else ParkTheme.type.badge,
            color = textColor,
        )
    }
}

/** Operator mark — HDB / URA / LTA / a mall operator. */
@Composable
fun OperatorBadge(operator: String, modifier: Modifier = Modifier) =
    ParkBadge(operator, modifier)

/**
 * Marks a rate that came from the stale 2018 LTA snapshot, so a 2018 figure is
 * never mistaken for a live, comparable price. Amber, because it is a caveat
 * rather than an error.
 */
@Composable
fun StaleRatesBadge(modifier: Modifier = Modifier) = ParkBadge(
    text = "2018 rate",
    modifier = modifier,
    textColor = ParkTheme.colors.warn,
    background = ParkTheme.colors.warnBg,
    borderColor = ParkTheme.colors.warn,
    emphasised = true,
)

/** The solid accent pill marking the cheapest result. */
@Composable
fun CheapestBadge(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(ParkTheme.dimens.radiusXs)
    Text(
        text = "CHEAPEST",
        style = ParkTheme.type.badgeTiny,
        color = ParkTheme.colors.accentOn,
        modifier = modifier
            .background(ParkTheme.colors.accent, shape)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

/**
 * EV connector chip. Three states, and the third one matters: when the feed is
 * stale the count is replaced by an em-dash and the chip goes muted, rather
 * than showing a number nobody can stand behind.
 */
@Composable
fun EvChip(
    availablePorts: Int,
    stale: Boolean,
    @DrawableRes boltIcon: Int,
    modifier: Modifier = Modifier,
) {
    val hasAvailable = !stale && availablePorts > 0
    ParkBadge(
        text = if (stale) "—" else availablePorts.toString(),
        modifier = modifier,
        textColor = if (hasAvailable) ParkTheme.colors.accent else ParkTheme.colors.text3,
        background = if (hasAvailable) ParkTheme.colors.accentTint else ParkTheme.colors.bg3,
        borderColor = if (hasAvailable) ParkTheme.colors.accent else ParkTheme.colors.lineStrong,
        leadingIcon = {
            Icon(
                painter = painterResource(boltIcon),
                contentDescription = null,
                tint = if (hasAvailable) ParkTheme.colors.accent else ParkTheme.colors.text3,
                modifier = Modifier.size(11.dp),
            )
        },
    )
}

/* ── Controls ─────────────────────────────────────────────────────────── */

/**
 * Filter pill.
 *
 * Inactive: hairline outline, secondary text, transparent fill.
 * Active:   1dp accent outline, accent-tinted fill, accent text.
 *
 * The active state is carried by colour AND weight AND border thickness, on
 * purpose — colour alone fails for colour-blind users and in bright sun.
 */
@Composable
fun FilterPill(
    label: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    @DrawableRes icon: Int? = null,
    showDot: Boolean = false,
) {
    val c = ParkTheme.colors
    val d = ParkTheme.dimens
    val shape = RoundedCornerShape(d.radiusPill)

    Row(
        modifier
            .defaultMinSize(minHeight = 26.dp)
            .background(if (active) c.accentTintStrong else Color.Transparent, shape)
            .border(
                width = if (active) d.strokeActive else d.hairline,
                color = if (active) c.accent else c.lineStrong,
                shape = shape,
            )
            .clip(shape)
            .clickable(role = Role.Checkbox, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (showDot) {
            Box(
                Modifier
                    .size(6.dp)
                    .background(if (active) c.accent else c.ok, RoundedCornerShape(percent = 50)),
            )
        }
        if (icon != null) {
            Icon(
                painter = painterResource(icon),
                contentDescription = null,
                tint = if (active) c.accent else c.text2,
                modifier = Modifier.size(13.dp),
            )
        }
        Text(
            text = label,
            style = ParkTheme.type.micro,
            color = if (active) c.accent else c.text2,
        )
    }
}

/**
 * Duration chip in the "planned stay" strip. Same visual grammar as
 * [FilterPill] but taller, because it is a primary choice rather than a
 * refinement — and the whole strip is a single radio group for screen readers.
 */
@Composable
fun DurationChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val c = ParkTheme.colors
    val d = ParkTheme.dimens
    val shape = RoundedCornerShape(d.radiusPill)

    Box(
        modifier
            .defaultMinSize(minHeight = 32.dp)
            .background(if (selected) c.accentTintStrong else c.bg1, shape)
            .border(
                width = if (selected) d.strokeActive else d.hairline,
                color = if (selected) c.accent else c.lineStrong,
                shape = shape,
            )
            .clip(shape)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .padding(
                horizontal = if (compact) 12.dp else 14.dp,
                vertical = if (compact) 6.dp else 9.dp,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = if (compact) ParkTheme.type.caption else ParkTheme.type.bodySm,
            color = if (selected) c.accent else c.text2,
        )
    }
}

/**
 * Primary call to action. Solid accent, 14dp radius, generous vertical
 * padding — this is the "Navigate" button, and it is pressed one-handed in a
 * moving car park, so it gets more height than a stock M3 button.
 */
@Composable
fun ParkPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    @DrawableRes leadingIcon: Int? = null,
    enabled: Boolean = true,
) {
    val c = ParkTheme.colors
    val shape = RoundedCornerShape(ParkTheme.dimens.radiusXl)

    Row(
        modifier
            .defaultMinSize(minHeight = ParkTheme.dimens.minTouchTarget)
            .background(if (enabled) c.accent else c.bg3, shape)
            .clip(shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 15.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leadingIcon != null) {
            Icon(
                painter = painterResource(leadingIcon),
                contentDescription = null,
                tint = if (enabled) c.accentOn else c.text3,
                modifier = Modifier.size(18.dp),
            )
        }
        Text(
            text = label,
            style = ParkTheme.type.bodySm,
            color = if (enabled) c.accentOn else c.text3,
        )
    }
}

/* ── Identity ─────────────────────────────────────────────────────────── */

/**
 * The wordmark: a gradient tile carrying a "P", then "wheretopark" in the
 * brand face with ".sg" dropped to the tertiary tier.
 *
 * This is the only place ParkBrand colours appear. The tile keeps its mint
 * gradient in every theme — the mark never changes.
 */
@Composable
fun Wordmark(
    modifier: Modifier = Modifier,
    size: TextUnit = 19.sp,
) {
    val tile = (size.value * 1.35f).dp
    Row(
        modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Box(
            Modifier
                .size(tile)
                .shadow(6.dp, RoundedCornerShape(10.dp), spotColor = ParkBrand.Brand)
                .background(
                    Brush.linearGradient(ParkBrand.TileGradient),
                    RoundedCornerShape(10.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "P",
                style = ParkTheme.type.wordmark.copy(fontSize = size * 0.92f),
                color = ParkBrand.BrandOn,
            )
        }
        Row {
            Text(
                text = "wheretopark",
                style = ParkTheme.type.wordmark.copy(fontSize = size),
                color = ParkTheme.colors.text1,
            )
            Text(
                text = ".sg",
                style = ParkTheme.type.wordmark.copy(
                    fontSize = size,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                ),
                color = ParkTheme.colors.text3,
            )
        }
    }
}

/* ── Feedback ─────────────────────────────────────────────────────────── */

/**
 * Toast. A card with a tinted icon tile, floating above the content — not a
 * Material Snackbar, which sits flush to the bottom edge and uses a different
 * radius and elevation.
 */
@Composable
fun ParkToast(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    @DrawableRes icon: Int? = null,
) {
    val c = ParkTheme.colors
    val shape = RoundedCornerShape(ParkTheme.dimens.radiusXl)

    Row(
        modifier
            .fillMaxWidth()
            .shadow(
                ParkTheme.dimens.elevationRaised,
                shape,
                ambientColor = ParkShadow.Navy,
                spotColor = ParkShadow.Navy,
            )
            .background(c.bg1, shape)
            .border(ParkTheme.dimens.hairline, c.lineStrong, shape)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (icon != null) {
            Box(
                Modifier
                    .size(30.dp)
                    .background(c.accentTintStrong, RoundedCornerShape(ParkTheme.dimens.radiusSm)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(icon),
                    contentDescription = null,
                    tint = c.accent,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = ParkTheme.type.bodySm, color = c.text1, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) {
                Text(subtitle, style = ParkTheme.type.captionSm, color = c.text3, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** The grab handle at the top of a bottom sheet. */
@Composable
fun SheetHandle(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .padding(top = 10.dp, bottom = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .width(38.dp)
                .height(4.dp)
                .background(ParkTheme.colors.lineStrong, RoundedCornerShape(percent = 50)),
        )
    }
}

/** Loading spinner — an accent arc on a lineStrong ring. */
@Composable
fun ParkSpinner(
    modifier: Modifier = Modifier,
    size: Dp = 14.dp,
) {
    val angle = rememberSpinRotation().value
    Box(
        modifier
            .size(size)
            .graphicsLayer { rotationZ = angle }
            .border(1.5.dp, ParkTheme.colors.lineStrong, RoundedCornerShape(percent = 50)),
    ) {
        // The single accent-coloured quadrant that makes the rotation readable.
        Box(
            Modifier
                .size(size / 2)
                .align(Alignment.TopCenter)
                .background(Color.Transparent)
                .border(1.5.dp, ParkTheme.colors.accent, RoundedCornerShape(percent = 50)),
        )
    }
}

/* ── The result card ──────────────────────────────────────────────────── */

/**
 * A carpark result. This is the screen the product lives or dies on, so the
 * hierarchy is worth stating explicitly:
 *
 *   1. PRICE, at 28sp, hard right. It is why someone opened the app.
 *   2. NAME, at 17sp, truncated to one line.
 *   3. Provenance row above the name — rank, operator, EV, caveats — all at
 *      10sp so it never competes with the two above.
 *   4. A hairline rule, then walk time on the left and live lots on the right.
 *
 * Unknowns render as an em-dash, never as a zero and never as a guess. A
 * fabricated "$0.00" is worse than admitting the rate is unknown.
 */
@Composable
fun CarparkCard(
    rank: Int,
    name: String,
    block: String,
    priceLabel: String,
    priceCaption: String,
    walkMinutes: Int,
    walkDistanceLabel: String,
    lotsLabel: String,
    availability: Availability,
    @DrawableRes walkIcon: Int,
    modifier: Modifier = Modifier,
    operator: String? = null,
    isCheapest: Boolean = false,
    isStaleRate: Boolean = false,
    active: Boolean = false,
    degraded: Boolean = false,
    onClick: () -> Unit = {},
) {
    val c = ParkTheme.colors

    ParkCard(modifier = modifier, active = active, onClick = onClick) {
        Column(Modifier.padding(start = 16.dp, end = 14.dp, top = 14.dp, bottom = 13.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(
                            text = "#$rank",
                            style = ParkTheme.type.badge,
                            color = if (isCheapest) c.accent else c.text3,
                        )
                        if (operator != null) OperatorBadge(operator)
                        if (isStaleRate) StaleRatesBadge()
                        if (isCheapest) CheapestBadge()
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = name,
                        style = ParkTheme.type.cardTitle,
                        color = c.text1,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(text = block, style = ParkTheme.type.captionSm, color = c.text3)
                }

                Spacer(Modifier.width(12.dp))

                Column(horizontalAlignment = Alignment.End) {
                    Text(text = priceLabel, style = ParkTheme.type.costHero, color = c.text1)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = priceCaption.uppercase(),
                        style = ParkTheme.type.badge,
                        color = if (isStaleRate) c.warn else c.text3,
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            ParkDivider()
            Spacer(Modifier.height(10.dp))

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(
                        painter = painterResource(walkIcon),
                        contentDescription = null,
                        tint = c.text2,
                        modifier = Modifier.size(14.dp),
                    )
                    Text("$walkMinutes min", style = ParkTheme.type.caption, color = c.text2)
                    Text("·", style = ParkTheme.type.caption, color = c.text3)
                    Text(walkDistanceLabel, style = ParkTheme.type.caption, color = c.text3)
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    AvailabilityDot(availability)
                    Text(
                        text = lotsLabel,
                        style = ParkTheme.type.caption,
                        color = when {
                            degraded -> c.text3
                            availability == Availability.Full -> c.bad
                            availability == Availability.Limited -> c.warn
                            else -> c.text1
                        },
                    )
                }
            }
        }
    }
}
