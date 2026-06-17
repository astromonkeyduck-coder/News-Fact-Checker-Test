import SwiftUI

/// Noteworthy button styles. Primary = red, the single decisive accent.
/// Secondary = graphite outline. Both compress slightly on press.
struct NTButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, destructive, ghost }
    var kind: Kind = .primary
    var fullWidth: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.ntInterSemiBold(15, relativeTo: .subheadline))
            .padding(.horizontal, Space.lg)
            .padding(.vertical, Space.md)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .foregroundStyle(foreground)
            .background(background(configuration.isPressed))
            .clipShape(RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: kind == .secondary || kind == .ghost ? 1 : 0)
            )
            .opacity(configuration.isPressed ? 0.9 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }

    private var foreground: Color {
        switch kind {
        case .primary, .destructive: return .white
        case .secondary: return NT.Palette.textPrimary
        case .ghost: return NT.Palette.textSecondary
        }
    }

    private func background(_ pressed: Bool) -> Color {
        switch kind {
        case .primary: return (pressed ? NT.Palette.accentHover : NT.Palette.accent)
        case .destructive: return NT.Palette.red.opacity(pressed ? 0.85 : 1)
        case .secondary: return NT.Palette.elevated
        case .ghost: return .clear
        }
    }

    private var borderColor: Color {
        kind == .ghost ? .clear : NT.Palette.border
    }
}
