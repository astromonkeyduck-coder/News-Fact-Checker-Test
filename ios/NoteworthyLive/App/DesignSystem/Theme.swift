import SwiftUI

/// Noteworthy News design language, translated directly from the website
/// (v2/styles/tokens.css). A deep NAVY newsroom canvas with blue-tinted
/// graphite surfaces, hairline borders, crisp off-white type, a confident BLUE
/// brand accent, and RED reserved strictly for live/breaking/error. No
/// decorative gradients, no glassmorphism. Colors are defined in code (sRGB)
/// so the palette is the single source of truth.
enum NT {

    // MARK: Palette (1:1 with the website design tokens)

    enum Palette {
        // Backgrounds, navy canvas + blue-tinted surfaces
        static let ink          = Color(hex: 0x080E1A) // --color-bg (app canvas)
        static let surfaceLow    = Color(hex: 0x0C1422) // --color-bg-secondary (bars/ticker)
        static let elevated      = Color(hex: 0x111C2E) // --color-bg-elevated
        static let surface       = Color(hex: 0x131F33) // --color-bg-card (cards/sheets)
        static let surfaceRaised = Color(hex: 0x182640) // --color-bg-surface (image/skeleton)

        // Text, off-white with the site's opacity tiers
        static let textPrimary   = Color(hex: 0xF0F2F5, alpha: 0.95)
        static let textSecondary = Color(hex: 0xF0F2F5, alpha: 0.55)
        static let textTertiary  = Color(hex: 0xF0F2F5, alpha: 0.32)

        // Borders, subtle white-alpha hairlines (not solid graphite)
        static let border       = Color.white.opacity(0.07) // --color-border
        static let borderStrong = Color.white.opacity(0.14) // --color-border-hover

        // Glass, restrained, layered translucency for the Live surface.
        // A faint top-edge highlight + a barely-there inner wash. NOT decorative
        // glassmorphism: these only sharpen micro-contrast on the navy canvas.
        static let glassHighlight = Color.white.opacity(0.06) // top hairline catch-light
        static let glassWash      = Color.white.opacity(0.02) // faint internal lift
        static let glassPanel     = Color.white.opacity(0.03) // inner action-bar panel

        // Brand accent, BLUE is the primary color across the product
        static let accent       = Color(hex: 0x3B8BF2) // --color-accent
        static let accentHover  = Color(hex: 0x5BA0F5) // --color-accent-hover
        static let accentMuted  = Color(hex: 0x3B8BF2, alpha: 0.12)

        // Signal colors, RED is live/breaking/error ONLY
        static let red    = Color(hex: 0xEF4444) // --color-live / --color-error
        static let amber  = Color(hex: 0xEAB308) // --color-warning
        static let green  = Color(hex: 0x22C55E) // --color-success
        static let blue   = Color(hex: 0x3B8BF2) // alias for verified/info contexts

        // Back-compat alias: some code referenced `red` as the accent during M1.
        // The true accent is `accent` (blue); keep `red` meaning live/breaking.
    }

    // MARK: Semantic roles

    enum Color_ {
        static let background = NT.Palette.ink
        static let surface    = NT.Palette.surface
        static let elevated   = NT.Palette.elevated
        static let separator  = NT.Palette.border
        static let accent     = NT.Palette.accent
    }

    // MARK: Status → color (aligned with v2/styles/live-rail.css)
    //   breaking / false_report → live red
    //   developing / disputed   → warning amber
    //   verified                → success green
    //   resolved                → muted
    //   default/update          → brand blue

    static func statusColor(_ status: String) -> Color {
        switch status {
        case "breaking":     return Palette.red
        case "false_report": return Palette.red
        case "verified":     return Palette.green
        case "developing":   return Palette.amber
        case "disputed":     return Palette.amber
        case "resolved":     return Palette.textSecondary
        default:             return Palette.accent
        }
    }

    static func statusLabel(_ status: String) -> String {
        switch status {
        case "breaking":     return "Breaking"
        case "developing":   return "Developing"
        case "verified":     return "Verified"
        case "disputed":     return "Disputed"
        case "resolved":     return "Resolved"
        case "false_report": return "Correction"
        default:             return "Update"
        }
    }

    /// Whether a status should read as high-urgency (red) in the UI.
    static func statusIsUrgent(_ status: String) -> Bool {
        status == "breaking" || status == "false_report"
    }

    // MARK: Radii (tight, editorial, echoes the site's 3-8px radii)

    enum Radius {
        static let card: CGFloat = 10
        static let cardTight: CGFloat = 12 // Live glass module, thin, premium
        static let chip: CGFloat = 6
        static let control: CGFloat = 8
        static let sheet: CGFloat = 20
    }
}

// MARK: - Glass surface

/// Restrained "Apple glass" card background for the Live surface: a translucent
/// tinted base over the navy canvas, a faint internal wash, and a hairline
/// top-edge catch-light that fades to the standard border. Urgent stories get a
/// subtle red-tinted edge; everything else stays calm. No big gradients, the
/// linear gradient is confined to the 1px stroke so it reads as a light edge,
/// not decoration.
private struct GlassCardBackground: View {
    var radius: CGFloat = NT.Radius.cardTight
    var urgent: Bool = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape
            .fill(NT.Palette.surface)
            .overlay(shape.fill(NT.Palette.glassWash))
            .overlay(
                shape.strokeBorder(
                    LinearGradient(
                        colors: urgent
                            ? [NT.Palette.red.opacity(0.45), NT.Palette.red.opacity(0.12)]
                            : [NT.Palette.glassHighlight, NT.Palette.border],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1
                )
            )
    }
}

extension View {
    /// Wrap content in the Live glass module surface (clip + layered background).
    func ntGlassCard(radius: CGFloat = NT.Radius.cardTight, urgent: Bool = false) -> some View {
        self
            .background(GlassCardBackground(radius: radius, urgent: urgent))
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

extension Color {
    /// Hex initializer (0xRRGGBB) for the brand palette.
    init(hex: UInt32, alpha: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
