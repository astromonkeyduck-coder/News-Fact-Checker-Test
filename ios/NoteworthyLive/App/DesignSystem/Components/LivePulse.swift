import SwiftUI

/// The signature Noteworthy "live" indicator: a small red dot with a soft
/// expanding ring. Honors Reduce Motion (falls back to a static dot) and is
/// hidden from VoiceOver (the surrounding label already says "Live").
struct LivePulse: View {
    var color: Color = NT.Palette.red
    var size: CGFloat = 8

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animate = false

    var body: some View {
        ZStack {
            if !reduceMotion {
                Circle()
                    .fill(color.opacity(0.35))
                    .frame(width: size * 2.4, height: size * 2.4)
                    .scaleEffect(animate ? 1 : 0.4)
                    .opacity(animate ? 0 : 0.8)
            }
            Circle()
                .fill(color)
                .frame(width: size, height: size)
        }
        .frame(width: size * 2.4, height: size * 2.4)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 1.4).repeatForever(autoreverses: false)) {
                animate = true
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    HStack(spacing: 20) {
        LivePulse()
        LivePulse(color: NT.Palette.amber, size: 10)
    }
    .padding(40)
    .background(NT.Palette.ink)
}
