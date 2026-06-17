import SwiftUI

/// Selectable topic/category chip for Explore and filters.
struct TopicChip: View {
    let title: String
    var isSelected: Bool = false
    var action: () -> Void = {}

    var body: some View {
        Button(action: {
            Haptics.select()
            action()
        }) {
            Text(title)
                .font(.ntMeta)
                .padding(.horizontal, Space.md)
                .padding(.vertical, Space.sm)
                .foregroundStyle(isSelected ? NT.Palette.ink : NT.Palette.textPrimary)
                .background(
                    RoundedRectangle(cornerRadius: NT.Radius.chip, style: .continuous)
                        .fill(isSelected ? NT.Palette.textPrimary : NT.Palette.elevated)
                        .overlay(
                            RoundedRectangle(cornerRadius: NT.Radius.chip, style: .continuous)
                                .strokeBorder(NT.Palette.border, lineWidth: isSelected ? 0 : 1)
                        )
                )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}

#Preview {
    HStack {
        TopicChip(title: "All", isSelected: true)
        TopicChip(title: "Politics")
        TopicChip(title: "Weather")
    }
    .padding(40)
    .background(NT.Palette.ink)
}
