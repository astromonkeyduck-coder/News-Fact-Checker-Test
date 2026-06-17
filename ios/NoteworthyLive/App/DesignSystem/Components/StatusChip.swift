import SwiftUI

/// Status pill, translated from the website's `.live-rail-status` / `.ls-status`:
/// a tinted capsule with a colored border, an uppercase mono label, and a status
/// dot. Breaking/developing pulse the dot. Calm by default; only genuinely live
/// states read red. No solid fills, matches the site's restrained treatment.
struct StatusChip: View {
    /// `.standard` keeps the original site-translated capsule (used everywhere
    /// else). `.glass` is the refined, denser Live-surface pill: tighter, a
    /// terminal-style status dot, layered glass tint + hairline edge.
    enum Style { case standard, glass }

    let status: String
    var showsPulse: Bool = true
    var style: Style = .standard

    private var color: Color { NT.statusColor(status) }
    private var label: String { NT.statusLabel(status) }
    private var pulses: Bool { showsPulse && (status == "breaking" || status == "developing") }

    var body: some View {
        switch style {
        case .standard: standard
        case .glass:    glass
        }
    }

    private var standard: some View {
        HStack(spacing: 5) {
            dot(size: 5)
            Text(label)
                .font(.ntKicker)
                .tracking(1.2)
                .textCase(.uppercase)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .foregroundStyle(color)
        .background(
            Capsule(style: .continuous)
                .fill(color.opacity(0.12))
                .overlay(Capsule(style: .continuous).strokeBorder(color.opacity(0.4), lineWidth: 1))
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Status: \(label)")
    }

    private var glass: some View {
        HStack(spacing: 5) {
            dot(size: 4.5)
            Text(label)
                .font(.ntInterSemiBold(10, relativeTo: .caption2))
                .tracking(0.9)
                .textCase(.uppercase)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .foregroundStyle(color)
        .background(
            Capsule(style: .continuous)
                .fill(color.opacity(0.10))
                .overlay(
                    Capsule(style: .continuous)
                        .fill(NT.Palette.glassWash)
                )
                .overlay(
                    Capsule(style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [color.opacity(0.55), color.opacity(0.22)],
                                startPoint: .top, endPoint: .bottom
                            ),
                            lineWidth: 0.75
                        )
                )
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Status: \(label)")
    }

    @ViewBuilder private func dot(size: CGFloat) -> some View {
        if pulses {
            LivePulse(color: color, size: size)
        } else {
            Circle().fill(color).frame(width: size, height: size)
        }
    }
}

#Preview {
    HStack(alignment: .top, spacing: 32) {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(["breaking", "developing", "verified", "disputed", "resolved", "false_report"], id: \.self) {
                StatusChip(status: $0)
            }
        }
        VStack(alignment: .leading, spacing: 12) {
            ForEach(["breaking", "developing", "verified", "disputed", "resolved", "false_report"], id: \.self) {
                StatusChip(status: $0, style: .glass)
            }
        }
    }
    .padding(40)
    .background(NT.Palette.ink)
}
