package sg.wheretopark.design

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * wheretopark.sg colour tokens.
 *
 * Generated from the web design system (src/index.css). Every value here is a
 * concrete ARGB — the web source expresses several of these as color-mix() or
 * rgba(), which have no Android equivalent, so they are pre-resolved.
 *
 * Components must never reference a raw Color. They read [ParkColors] from
 * `ParkTheme.colors`, which is what makes a theme swap a one-line change that
 * touches no component.
 */
@Immutable
data class ParkColors(
    /** Page ground, behind cards. */
    val bg0: Color,
    /** Card / sheet / elevated surface. */
    val bg1: Color,
    /** Inset fields and recessed wells. */
    val bg2: Color,
    /** Chips, badges, icon tiles. */
    val bg3: Color,
    /** Hairline dividers and card edges — use at 0.5.dp. */
    val line: Color,
    /** Control outlines: inputs, chips, buttons. Meets WCAG 1.4.11 (3:1). */
    val lineStrong: Color,
    /** Primary text and hero numbers. */
    val text1: Color,
    /** Secondary text and supporting labels. */
    val text2: Color,
    /** Tertiary: addresses, source lines, placeholders, eyebrow labels. */
    val text3: Color,
    /** Lots available. */
    val ok: Color,
    val okBg: Color,
    /** Limited lots and stale-data warnings. */
    val warn: Color,
    val warnBg: Color,
    /** Full, or error. */
    val bad: Color,
    val badBg: Color,
    /** Availability unknown. */
    val mutedStatus: Color,
    val mutedStatusBg: Color,
    /** The functional accent: primary buttons, selection, links, focus ring. */
    val accent: Color,
    /** Foreground on an accent fill. */
    val accentOn: Color,
    /** accent at 11% over bg1 — icon tiles and soft fills. */
    val accentTint: Color,
    /** accent at 20% over bg1 — selected chip fill, toast icon tile. */
    val accentTintStrong: Color,
    /** Links and info highlights. */
    val accentBlue: Color,
    val accentBlueBg: Color,
    /** Backing for chips that float over the walk map. */
    val glass: Color,
    /** Per-source chart series. */
    val srcHdb: Color,
    val srcUra: Color,
    val srcLta: Color,
    val srcEv: Color,
    /** True when this palette is dark — drives status-bar icon polarity. */
    val isDark: Boolean,
)

/**
 * Brand colours. These belong to the LOGO and nothing else.
 *
 * The bright mint teal is deliberately not the UI accent: the accent is the
 * deeper, higher-contrast [ParkColors.accent]. Using the brand mint for a
 * button or a selected state is the single easiest way to make this app stop
 * looking like wheretopark.sg.
 */
object ParkBrand {
    val Brand = Color(0xFF2EE3C2)
    val Brand2 = Color(0xFF14C9B6)
    val BrandOn = Color(0xFF0B2E2A)
    val BrandGlow = Color(0x732EE3C2)

    /** 145° gradient used for the rounded logo tile. */
    val TileGradient = listOf(Brand, Brand2)
}

/**
 * Sunlight — the default theme, and the one to build against first.
 *
 * Tuned for the real use case: a phone at arm's length in Singapore daylight,
 * where a 6% shadow, a 1.13:1 hairline and a near-white page ground all vanish
 * at once. Three things carry it — a grey page ground so white cards read as
 * objects, every text tier and status colour past 4.5:1, and borders/shadows
 * heavy enough that a 0.5dp hairline still shows.
 */
val SunlightColors = ParkColors(
    bg0 = Color(0xFFEEF1F5),
    bg1 = Color(0xFFFFFFFF),
    bg2 = Color(0xFFE4E9F1),
    bg3 = Color(0xFFDBE2EC),
    line = Color(0xFF9AA4B5),            // 2.5:1
    lineStrong = Color(0xFF7D8798),      // 3.6:1
    text1 = Color(0xFF141A22),           // 16.6:1
    text2 = Color(0xFF4A5768),           // 7.4:1
    text3 = Color(0xFF5F6D80),           // 5.3:1
    ok = Color(0xFF036347),              // 7.3:1
    okBg = Color(0xFFD8F0E6),
    warn = Color(0xFF7A4E00),            // 7.2:1
    warnBg = Color(0xFFFBEACB),
    bad = Color(0xFFB00020),             // 7.3:1
    badBg = Color(0xFFFBDDE1),
    mutedStatus = Color(0xFF3A4657),
    mutedStatusBg = Color(0xFFDDE4EE),
    accent = Color(0xFF0B5C55),          // 7.9:1
    accentOn = Color(0xFFFFFFFF),
    accentTint = Color(0xFFE4EDEC),
    accentTintStrong = Color(0xFFCEDEDD),
    accentBlue = Color(0xFF3636C9),      // 8.3:1
    accentBlueBg = Color(0xFFE2E2FB),
    glass = Color(0xF0FFFFFF),
    srcHdb = Color(0xFF0B5C55),
    srcUra = Color(0xFF3636C9),
    srcLta = Color(0xFF7A4E00),
    srcEv = Color(0xFF6A10BD),
    isDark = false,
)

/** Standard — the original soft light theme. Lower contrast, calmer indoors. */
val StandardColors = ParkColors(
    bg0 = Color(0xFFFAFAFA),
    bg1 = Color(0xFFFFFFFF),
    bg2 = Color(0xFFF5F7F9),
    bg3 = Color(0xFFEEF2F8),
    line = Color(0xFFE9EFF7),
    lineStrong = Color(0xFFC1D0E5),
    text1 = Color(0xFF242A33),
    text2 = Color(0xFF58677D),
    text3 = Color(0xFF8A97AA),
    ok = Color(0xFF0E9E6E),
    okBg = Color(0xFFE2F7EF),
    warn = Color(0xFFB8810F),
    warnBg = Color(0xFFFEF1DC),
    bad = Color(0xFFEC113A),
    badBg = Color(0xFFFBE0E5),
    mutedStatus = Color(0xFF58677D),
    mutedStatusBg = Color(0xFFEEF2F8),
    accent = Color(0xFF0D9488),
    accentOn = Color(0xFFFFFFFF),
    accentTint = Color(0xFFE4F3F2),
    accentTintStrong = Color(0xFFCFEAE7),
    accentBlue = Color(0xFF5050FA),
    accentBlueBg = Color(0xFFECECFE),
    glass = Color(0xD1FFFFFF),
    srcHdb = Color(0xFF0D9488),
    srcUra = Color(0xFF5050FA),
    srcLta = Color(0xFFFCAE30),
    srcEv = Color(0xFF921FFF),
    isDark = false,
)

/** Dark — near-black, easier at night. */
val DarkColors = ParkColors(
    bg0 = Color(0xFF12151A),
    bg1 = Color(0xFF1A1E25),
    bg2 = Color(0xFF20252E),
    bg3 = Color(0xFF2A313C),
    line = Color(0x24FFFFFF),
    lineStrong = Color(0x57FFFFFF),      // 3.0:1 on bg1
    text1 = Color(0xFFF5F7FA),
    text2 = Color(0xA8F5F7FA),           // 7.4:1
    text3 = Color(0x85F5F7FA),           // 5.2:1
    ok = Color(0xFF25D092),
    okBg = Color(0x2625D092),
    warn = Color(0xFFFCAE30),
    warnBg = Color(0x29FCAE30),
    bad = Color(0xFFFF5A6E),
    badBg = Color(0x26FF5A6E),
    mutedStatus = Color(0xFF8A97AA),
    mutedStatusBg = Color(0x298A97AA),
    accent = Color(0xFF2DD4BF),
    accentOn = Color(0xFF062925),
    accentTint = Color(0xFF1C3236),
    accentTintStrong = Color(0xFF1E4244),
    accentBlue = Color(0xFF5050FA),
    accentBlueBg = Color(0xFFECECFE),
    glass = Color(0xD11A1E25),
    srcHdb = Color(0xFF2DD4BF),
    srcUra = Color(0xFF5050FA),
    srcLta = Color(0xFFFCAE30),
    srcEv = Color(0xFF921FFF),
    isDark = true,
)
