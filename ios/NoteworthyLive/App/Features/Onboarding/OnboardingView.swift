import SwiftUI
import ActivityKit

/// First-run flow. Four plain-language value slides, each anchored by a compact,
/// realistic product preview (not a giant symbol), then a permission screen that
/// requests notifications when the user taps the CTA. Calm, editorial, native.
struct OnboardingView: View {
    var onFinish: () -> Void

    @EnvironmentObject var notifications: NotificationManager
    @State private var page = 0

    private let pages = OnboardingPage.all

    var body: some View {
        ZStack {
            NT.Palette.ink.ignoresSafeArea()

            VStack(spacing: 0) {
                Rectangle().fill(NT.Palette.accent).frame(height: 2)

                header

                TabView(selection: $page) {
                    ForEach(pages.indices, id: \.self) { i in
                        OnboardingPageView(page: pages[i]).tag(i)
                    }
                    PermissionPageView().tag(pages.count)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.easeInOut, value: page)

                footer
            }
        }
    }

    private var header: some View {
        HStack {
            Masthead(size: 17)
            Spacer()
            if page < pages.count {
                Button("Skip") { finish() }
                    .font(.ntMeta)
                    .foregroundStyle(NT.Palette.textSecondary)
            }
        }
        .padding(.horizontal, Space.lg)
        .padding(.top, Space.lg)
    }

    private var footer: some View {
        VStack(spacing: Space.lg) {
            PageDots(count: pages.count + 1, index: page)
            Button(footerTitle) { advance() }
                .buttonStyle(NTButtonStyle(kind: .primary, fullWidth: true))
        }
        .padding(.horizontal, Space.lg)
        .padding(.bottom, Space.xl)
    }

    private var footerTitle: String {
        page == pages.count ? "Allow notifications" : "Continue"
    }

    private func advance() {
        Haptics.tap()
        if page < pages.count {
            withAnimation { page += 1 }
        } else {
            // Permission screen: request at the moment of intent, then enter the app.
            Task {
                await notifications.requestAuthorization()
                finish()
            }
        }
    }

    private func finish() {
        Haptics.success()
        onFinish()
    }
}

// MARK: - Slides

struct OnboardingPage: Identifiable {
    enum Preview { case breaking, timeline, alert, deepLink }
    let id = UUID()
    let title: String
    let body: String
    let preview: Preview

    static let all: [OnboardingPage] = [
        .init(title: "Follow breaking news live",
              body: "Track developing stories as they unfold, with clear status updates and verified context.",
              preview: .breaking),
        .init(title: "Know what changed",
              body: "See each update in one live timeline, from first reports to final confirmation.",
              preview: .timeline),
        .init(title: "Get alerts that matter",
              body: "Follow the stories you care about and get notified when there's a major update.",
              preview: .alert),
        .init(title: "Open straight to the story",
              body: "Alerts and Live Activities take you directly to the latest update.",
              preview: .deepLink),
    ]
}

private struct OnboardingPageView: View {
    let page: OnboardingPage

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xl) {
            Spacer(minLength: Space.lg)

            OnboardingPreview(kind: page.preview)
                .frame(maxWidth: 340)
                .frame(maxWidth: .infinity, alignment: .center)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Space.sm) {
                Text(page.title)
                    .font(.ntSoraExtraBold(28, relativeTo: .largeTitle))
                    .foregroundStyle(NT.Palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(page.body)
                    .font(.ntBody)
                    .foregroundStyle(NT.Palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: Space.lg)
        }
        .padding(.horizontal, Space.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct PermissionPageView: View {
    private var liveActivitiesAvailable: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xl) {
            Spacer(minLength: Space.lg)

            AlertPreview()
                .frame(maxWidth: 340)
                .frame(maxWidth: .infinity, alignment: .center)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Space.sm) {
                Text("Turn on Live Activities")
                    .font(.ntSoraExtraBold(28, relativeTo: .largeTitle))
                    .foregroundStyle(NT.Palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Follow a developing story and watch it update right on your Lock Screen and Dynamic Island. Breaking-news and story push alerts are rolling out soon, allow notifications now so you're ready.")
                    .font(.ntBody)
                    .foregroundStyle(NT.Palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                availabilityRow.padding(.top, Space.xs)
            }

            Spacer(minLength: Space.lg)
        }
        .padding(.horizontal, Space.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var availabilityRow: some View {
        HStack(spacing: Space.sm) {
            Image(systemName: liveActivitiesAvailable ? "checkmark.circle.fill" : "exclamationmark.circle")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(liveActivitiesAvailable ? NT.Palette.green : NT.Palette.amber)
            Text(liveActivitiesAvailable
                 ? "Live Activities are available on this iPhone."
                 : "Turn on Live Activities in Settings to follow updates from the Lock Screen.")
                .font(.ntMeta)
                .foregroundStyle(NT.Palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Editorial previews (decorative, non-interactive)

private struct OnboardingPreview: View {
    let kind: OnboardingPage.Preview
    var body: some View {
        switch kind {
        case .breaking: BreakingCardPreview()
        case .timeline: TimelinePreview()
        case .alert:    AlertPreview()
        case .deepLink: DeepLinkPreview()
        }
    }
}

/// Mini breaking story card.
private struct BreakingCardPreview: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            StatusChip(status: "breaking", showsPulse: false)
            Text("Senate passes infrastructure package after overnight session")
                .font(.ntSerifSemiBold(18, relativeTo: .headline))
                .foregroundStyle(NT.Palette.textPrimary)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: Space.sm) {
                Text("Noteworthy Desk").font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
                Circle().fill(NT.Palette.textTertiary).frame(width: 2.5, height: 2.5)
                Text("2m").font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
            }
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            ZStack(alignment: .leading) {
                NT.Palette.surface
                Rectangle().fill(NT.Palette.red).frame(width: 3)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous).strokeBorder(NT.Palette.border, lineWidth: 1))
    }
}

/// Compact three-row live timeline.
private struct TimelinePreview: View {
    private struct Item { let label: String; let color: Color; let body: String; let time: String; let major: Bool }
    private let items: [Item] = [
        .init(label: "UPDATE", color: NT.Palette.red, body: "Officials confirm the latest figures.", time: "2m", major: true),
        .init(label: "DEVELOPING", color: NT.Palette.amber, body: "Briefing underway; details to follow.", time: "18m", major: false),
        .init(label: "DEVELOPING", color: NT.Palette.amber, body: "First reports come in.", time: "40m", major: false),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { idx, item in
                row(item, isFirst: idx == 0, isLast: idx == items.count - 1)
            }
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(NT.Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous).strokeBorder(NT.Palette.border, lineWidth: 1))
    }

    private func row(_ item: Item, isFirst: Bool, isLast: Bool) -> some View {
        HStack(alignment: .top, spacing: Space.md) {
            VStack(spacing: 0) {
                Rectangle().fill(isFirst ? .clear : NT.Palette.border).frame(width: 2, height: 8)
                Circle().fill(item.color)
                    .frame(width: item.major ? 9 : 7, height: item.major ? 9 : 7)
                    .overlay(Circle().stroke(NT.Palette.surface, lineWidth: 2))
                Rectangle().fill(isLast ? .clear : NT.Palette.border).frame(width: 2).frame(maxHeight: .infinity)
            }
            .frame(width: 10)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Space.sm) {
                    Text(item.label).font(.ntKicker).tracking(1.1).textCase(.uppercase).foregroundStyle(item.color)
                    Text(item.time).font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                }
                Text(item.body).font(.ntDek).foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(1)
            }
            .padding(.bottom, isLast ? 0 : Space.md)
        }
    }
}

/// Lock-Screen-style notification banner.
private struct AlertPreview: View {
    var body: some View {
        HStack(alignment: .top, spacing: Space.sm) {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(NT.Palette.ink)
                .frame(width: 40, height: 40)
                .overlay(
                    Text("NW")
                        .font(.ntSoraExtraBold(15, relativeTo: .headline))
                        .tracking(-0.6)
                        .foregroundStyle(NT.Palette.textPrimary)
                )
                .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).strokeBorder(NT.Palette.border, lineWidth: 1))

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text("NOTEWORTHY")
                        .font(.ntInterSemiBold(11, relativeTo: .caption2)).tracking(0.8)
                        .foregroundStyle(NT.Palette.textSecondary)
                    Spacer(minLength: Space.sm)
                    Text("now").font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
                }
                Text("Major update: officials confirm the latest figures.")
                    .font(.ntInterSemiBold(13, relativeTo: .subheadline))
                    .foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(NT.Palette.elevated)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(NT.Palette.border, lineWidth: 1))
    }
}

/// Compact tap-through banner conveying "opens straight to the story".
private struct DeepLinkPreview: View {
    var body: some View {
        HStack(spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.sm) {
                StatusChip(status: "developing", showsPulse: false)
                Text("Tropical storm makes landfall before dawn")
                    .font(.ntSerifSemiBold(16, relativeTo: .subheadline))
                    .foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Space.sm)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(NT.Palette.textTertiary)
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(NT.Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: NT.Radius.card, style: .continuous).strokeBorder(NT.Palette.border, lineWidth: 1))
    }
}

// MARK: - Small pieces

/// Editorial masthead wordmark. "NOTEWORTHY" set in Sora ExtraBold with open
/// newsroom letter-spacing. No container, no orb, no pill, no badge.
struct Masthead: View {
    var size: CGFloat = 19

    var body: some View {
        Text("NOTEWORTHY")
            .font(.ntSoraExtraBold(size, relativeTo: .headline))
            .tracking(2.0)
            .foregroundStyle(NT.Palette.textPrimary)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Noteworthy News")
    }
}

/// Square "NW" monogram, set in Sora ExtraBold. Mirrors the app icon / launch
/// mark. Used by the splash and anywhere a compact mark fits.
struct NWMark: View {
    var size: CGFloat = 60

    var body: some View {
        Text("NW")
            .font(.ntSoraExtraBold(size, relativeTo: .largeTitle))
            .tracking(-size * 0.05)
            .foregroundStyle(NT.Palette.textPrimary)
            .accessibilityHidden(true)
    }
}

private struct PageDots: View {
    let count: Int
    let index: Int
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(i == index ? NT.Palette.accent : NT.Palette.border)
                    .frame(width: i == index ? 18 : 6, height: 6)
                    .animation(.easeInOut, value: index)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    OnboardingView(onFinish: {})
        .environmentObject(NotificationManager.shared)
}
