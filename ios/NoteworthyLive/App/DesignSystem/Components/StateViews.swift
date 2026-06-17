import SwiftUI

/// Shared empty / error / offline states. Calm, centered, never childish.
struct EmptyStateView: View {
    var systemImage: String = "tray"
    var title: String
    var message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Space.md) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .regular))
                .foregroundStyle(NT.Palette.textTertiary)
            Text(title)
                .font(.ntCardTitle)
                .foregroundStyle(NT.Palette.textPrimary)
            Text(message)
                .font(.ntBody)
                .foregroundStyle(NT.Palette.textSecondary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(NTButtonStyle(kind: .secondary))
                    .padding(.top, Space.xs)
            }
        }
        .padding(Space.xl)
        .frame(maxWidth: .infinity)
    }
}

struct ErrorStateView: View {
    var title: String = "Something went wrong"
    var message: String
    var retry: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Space.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 34, weight: .regular))
                .foregroundStyle(NT.Palette.amber)
            Text(title)
                .font(.ntCardTitle)
                .foregroundStyle(NT.Palette.textPrimary)
            Text(message)
                .font(.ntBody)
                .foregroundStyle(NT.Palette.textSecondary)
                .multilineTextAlignment(.center)
            if let retry {
                Button("Try again", action: retry)
                    .buttonStyle(NTButtonStyle(kind: .secondary))
                    .padding(.top, Space.xs)
            }
        }
        .padding(Space.xl)
        .frame(maxWidth: .infinity)
    }
}

/// Persistent banner shown when the device is offline.
struct OfflineBanner: View {
    var body: some View {
        HStack(spacing: Space.sm) {
            Image(systemName: "wifi.slash")
            Text("You're offline, showing the latest cached stories")
                .font(.ntMeta)
            Spacer()
        }
        .foregroundStyle(NT.Palette.textPrimary)
        .padding(.horizontal, Space.lg)
        .padding(.vertical, Space.sm)
        .background(NT.Palette.elevated)
        .overlay(Rectangle().fill(NT.Palette.amber).frame(height: 2), alignment: .top)
        .accessibilityElement(children: .combine)
    }
}
