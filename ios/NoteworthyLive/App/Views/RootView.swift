import SwiftUI

/// Root gate: a premium branded splash on cold launch (seamless from the static
/// Launch Screen), then onboarding once, then the full tabbed app shell.
struct RootView: View {
    @AppStorage("didCompleteOnboarding") private var didOnboard = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showSplash = true
    @State private var contentOffset: CGFloat = 6

    var body: some View {
        ZStack {
            NT.Palette.ink.ignoresSafeArea()

            Group {
                if didOnboard {
                    AppShell()
                } else {
                    OnboardingView(onFinish: { withAnimation(.easeInOut) { didOnboard = true } })
                }
            }
            .opacity(showSplash ? 0 : 1)
            // The app content "settles" up as the splash dissolves, so launch ->
            // splash -> app reads as one deliberate motion, never a jump cut.
            .offset(y: showSplash ? contentOffset : 0)

            if showSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .task {
            // Hold briefly so the launch->splash->app handoff reads as one motion.
            let hold: UInt64 = reduceMotion ? 850_000_000 : 1_300_000_000
            try? await Task.sleep(nanoseconds: hold)
            withAnimation(.easeInOut(duration: reduceMotion ? 0.35 : 0.55)) {
                showSplash = false
                contentOffset = 0
            }
        }
    }
}

/// Animated splash — "Signal Lock". Continues seamlessly from the static Launch
/// Screen (same navy canvas + same centered NW mark tile), then the mark settles,
/// a thin newswire line draws to a single calm blue signal pulse, the NOTEWORTHY
/// wordmark prints in via a left-to-right wipe, and a few faint feed lines resolve
/// beneath it like a feed loading — before the whole thing cross-dissolves into
/// Home. Reduce-motion safe. No glow blobs, no spinner, no cheese.
struct SplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Hero mark settle.
    @State private var markScale: CGFloat = 1.05
    // Wordmark left-to-right reveal (0...1).
    @State private var wordmarkReveal: CGFloat = 0
    // Newswire line draw width + trailing pulse.
    @State private var wireWidth: CGFloat = 0
    @State private var pulseIn = false
    // Faint feed-line resolve.
    @State private var feedIn = false

    private let markSize: CGFloat = 108
    private let wireMaxWidth: CGFloat = 128

    var body: some View {
        ZStack {
            NT.Palette.ink.ignoresSafeArea()

            // The mark stays at the exact screen center so it lands precisely on
            // top of the static Launch Screen's mark (no position jump). The
            // wordmark, wire and feed lines are anchored BELOW it via offsets.
            Image("LaunchMark")
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .frame(width: markSize, height: markSize)
                .scaleEffect(markScale)
                .shadow(color: .black.opacity(0.35), radius: 14, y: 8)
                .shadow(color: NT.Palette.accent.opacity(0.18), radius: 18, y: 0)

            VStack(spacing: Space.md) {
                wordmark
                newswire
            }
            .offset(y: markSize / 2 + 44)

            feedLines
                .offset(y: markSize / 2 + 158)
        }
        .onAppear(perform: animateIn)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Noteworthy News")
    }

    // MARK: Pieces

    private var wordmark: some View {
        Text("NOTEWORTHY")
            .font(.ntSoraExtraBold(15, relativeTo: .subheadline))
            .tracking(3.4)
            .foregroundStyle(NT.Palette.textPrimary)
            .mask(
                // Left-to-right wipe: a rectangle whose width grows from the
                // leading edge, so the wordmark "prints" like a wire feed.
                GeometryReader { geo in
                    Rectangle()
                        .frame(width: max(0, geo.size.width * wordmarkReveal))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                }
            )
    }

    private var newswire: some View {
        HStack(spacing: 7) {
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [NT.Palette.accent.opacity(0), NT.Palette.accent.opacity(0.65)],
                        startPoint: .leading, endPoint: .trailing
                    )
                )
                .frame(width: wireWidth, height: 1.5)
            // A single calm signal pulse (blue = connected/live signal; red stays
            // reserved for breaking).
            ZStack {
                if !reduceMotion {
                    Circle()
                        .fill(NT.Palette.accent.opacity(0.30))
                        .frame(width: 12, height: 12)
                        .scaleEffect(pulseIn ? 1 : 0.4)
                        .opacity(pulseIn ? 0 : 0.9)
                }
                Circle()
                    .fill(NT.Palette.accent)
                    .frame(width: 5, height: 5)
            }
            .frame(width: 12, height: 12)
            .opacity(wireWidth > 0 ? 1 : 0)
        }
        .frame(height: 12)
    }

    private var feedLines: some View {
        VStack(spacing: 7) {
            feedLine(width: 96, index: 0)
            feedLine(width: 64, index: 1)
            feedLine(width: 80, index: 2)
        }
    }

    private func feedLine(width: CGFloat, index: Int) -> some View {
        Capsule()
            .fill(NT.Palette.textPrimary.opacity(0.07))
            .frame(width: width, height: 3)
            .opacity(feedIn ? 1 : 0)
            .animation(
                reduceMotion ? nil : .easeOut(duration: 0.5).delay(0.70 + Double(index) * 0.09),
                value: feedIn
            )
    }

    // MARK: Motion

    private func animateIn() {
        guard !reduceMotion else {
            markScale = 1
            wordmarkReveal = 1
            wireWidth = wireMaxWidth
            feedIn = true
            return
        }

        withAnimation(.easeOut(duration: 0.75)) { markScale = 1 }
        withAnimation(.easeOut(duration: 0.6).delay(0.22)) { wordmarkReveal = 1 }
        withAnimation(.easeInOut(duration: 0.55).delay(0.40)) { wireWidth = wireMaxWidth }
        withAnimation(.easeOut(duration: 1.3).delay(0.55).repeatForever(autoreverses: false)) { pulseIn = true }
        // Feed lines stagger in via per-line implicit animation (see feedLine).
        feedIn = true
    }
}
