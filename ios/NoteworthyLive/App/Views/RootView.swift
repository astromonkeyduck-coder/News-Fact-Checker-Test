import SwiftUI

/// Root gate: a premium branded splash on cold launch (seamless from the static
/// Launch Screen), then onboarding once, then the full tabbed app shell.
struct RootView: View {
    @AppStorage("didCompleteOnboarding") private var didOnboard = false
    @State private var showSplash = true

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

            if showSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .task {
            // Hold briefly so the launch->splash->app handoff reads as one motion.
            try? await Task.sleep(nanoseconds: 1_250_000_000)
            withAnimation(.easeOut(duration: 0.5)) { showSplash = false }
        }
    }
}

/// Animated splash. Continues seamlessly from the static Launch Screen (same
/// navy canvas + centered NW mark), then the mark settles with a soft blue glow
/// and the NOTEWORTHY wordmark resolves beneath it, before cross-fading into the
/// app. Reduce-motion safe. No cheesy effects.
struct SplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var markScale: CGFloat = 1.04
    @State private var glow: Double = 0
    @State private var wordmark: Double = 0
    @State private var wordmarkOffset: CGFloat = 6

    var body: some View {
        ZStack {
            NT.Palette.ink.ignoresSafeArea()

            // Soft brand glow behind the mark.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [NT.Palette.accent.opacity(0.20), .clear],
                        center: .center, startRadius: 4, endRadius: 170
                    )
                )
                .frame(width: 340, height: 340)
                .opacity(glow)
                .blur(radius: 8)

            VStack(spacing: Space.lg) {
                // Same NW mark shown on the static Launch Screen (seamless handoff).
                Image("LaunchMark")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 96, height: 96)
                    .scaleEffect(markScale)
                    .shadow(color: NT.Palette.accent.opacity(0.28), radius: 24, y: 6)

                Text("NOTEWORTHY")
                    .font(.ntSoraExtraBold(15, relativeTo: .subheadline))
                    .tracking(3.2)
                    .foregroundStyle(NT.Palette.textPrimary)
                    .opacity(wordmark)
                    .offset(y: wordmarkOffset)
            }
        }
        .onAppear {
            guard !reduceMotion else { glow = 1; wordmark = 1; wordmarkOffset = 0; markScale = 1; return }
            withAnimation(.easeOut(duration: 0.8)) {
                markScale = 1.0
                glow = 1
            }
            withAnimation(.easeOut(duration: 0.55).delay(0.30)) {
                wordmark = 1
                wordmarkOffset = 0
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Noteworthy News")
    }
}
