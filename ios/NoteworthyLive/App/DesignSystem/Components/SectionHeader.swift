import SwiftUI

/// Section header with an optional kicker accent bar and trailing action.
struct SectionHeader<Trailing: View>: View {
    let title: String
    var accent: Color = NT.Palette.accent
    var showsAccentBar: Bool = true
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center, spacing: Space.sm) {
            if showsAccentBar {
                RoundedRectangle(cornerRadius: 2)
                    .fill(accent)
                    .frame(width: 3, height: 16)
            }
            Text(title)
                .font(.ntSoraExtraBold(17, relativeTo: .headline))
                .foregroundStyle(NT.Palette.textPrimary)
            Spacer(minLength: Space.sm)
            trailing()
        }
        .accessibilityAddTraits(.isHeader)
    }
}

extension SectionHeader where Trailing == EmptyView {
    init(title: String, accent: Color = NT.Palette.accent, showsAccentBar: Bool = true) {
        self.init(title: title, accent: accent, showsAccentBar: showsAccentBar) { EmptyView() }
    }
}

#Preview {
    VStack(spacing: 20) {
        SectionHeader(title: "Developing Now")
        SectionHeader(title: "Latest") {
            Text("See all").font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
        }
    }
    .padding()
    .background(NT.Palette.ink)
}
