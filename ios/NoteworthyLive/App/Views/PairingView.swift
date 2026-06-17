import SwiftUI
import UIKit

/// Premium, Noteworthy-native pairing flow. The user generates a short code on
/// the website (Notification settings → "Open in the iOS app") and enters it
/// here via a segmented 6-cell input. Seamless touches: auto-focus, clipboard
/// auto-fill, auto-submit on the final character, and a brief success beat
/// before the sheet dismisses.
struct PairingView: View {
    private static let codeLength = 6
    /// Matches the backend alphabet (no ambiguous 0/O/1/I) from device-link.js.
    private static let alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

    @State private var code = ""
    @State private var lastCount = 0
    @State private var working = false
    @State private var succeeded = false
    @State private var errorText: String?
    @State private var shake: CGFloat = 0
    @State private var clipboardCode: String?
    @FocusState private var focused: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var onPaired: ([FollowedStory]) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: Space.xl) {
                hero
                steps
                codeSection
                manualButton
            }
            .padding(.horizontal, Space.lg)
            .padding(.vertical, Space.xxl)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(NT.Palette.ink)
        .onAppear {
            detectClipboard()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { focused = true }
        }
        .onChange(of: code) { newValue in
            if newValue.count > lastCount { Haptics.select() }
            lastCount = newValue.count
            if errorText != nil { errorText = nil }
            if newValue.count == Self.codeLength { submit() }
        }
    }

    // MARK: Hero

    private var hero: some View {
        VStack(spacing: Space.md) {
            ZStack {
                Circle()
                    .fill(NT.Palette.accentMuted)
                    .frame(width: 76, height: 76)
                    .overlay(Circle().strokeBorder(NT.Palette.accent.opacity(0.35), lineWidth: 1))
                Image(systemName: "iphone.radiowaves.left.and.right")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(NT.Palette.accent)
            }

            Text("Link this iPhone")
                .font(.ntSoraSemiBold(22, relativeTo: .title2))
                .foregroundStyle(NT.Palette.textPrimary)

            Text("Pair with your noteworthynews.co follows to bring your live stories here and use Live Activities.")
                .font(.ntDek)
                .foregroundStyle(NT.Palette.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, Space.sm)
        }
    }

    // MARK: Steps

    private var steps: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            stepRow(1, "Open Notification settings on noteworthynews.co")
            Divider().overlay(NT.Palette.border)
            stepRow(2, "Tap \u{201C}Open in the iOS app\u{201D} to reveal your code")
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .ntGlassCard()
    }

    private func stepRow(_ n: Int, _ text: String) -> some View {
        HStack(spacing: Space.md) {
            Text("\(n)")
                .font(.ntInterSemiBold(12, relativeTo: .caption))
                .foregroundStyle(NT.Palette.accent)
                .frame(width: 22, height: 22)
                .background(Circle().fill(NT.Palette.accentMuted))
            Text(text)
                .font(.ntMeta)
                .foregroundStyle(NT.Palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    // MARK: Code entry

    private var codeSection: some View {
        VStack(spacing: Space.md) {
            if let clip = clipboardCode, code.isEmpty, !succeeded {
                Button { fillFromClipboard(clip) } label: {
                    HStack(spacing: Space.xs) {
                        Image(systemName: "doc.on.clipboard.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text("Paste \(clip)")
                            .font(.ntInterSemiBold(12, relativeTo: .caption))
                    }
                    .foregroundStyle(NT.Palette.accent)
                    .padding(.horizontal, Space.md)
                    .padding(.vertical, Space.sm)
                    .background(
                        Capsule()
                            .fill(NT.Palette.accentMuted)
                            .overlay(Capsule().strokeBorder(NT.Palette.accent.opacity(0.35), lineWidth: 1))
                    )
                }
                .buttonStyle(.plain)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            codeCells
                .modifier(ShakeEffect(animatableData: shake))

            statusLine
                .frame(minHeight: 20)
                .animation(.easeInOut(duration: 0.2), value: errorText)
                .animation(.easeInOut(duration: 0.2), value: succeeded)
        }
    }

    @ViewBuilder private var statusLine: some View {
        if let errorText {
            Label(errorText, systemImage: "exclamationmark.triangle.fill")
                .font(.ntMeta)
                .foregroundStyle(NT.Palette.red)
                .multilineTextAlignment(.center)
        } else if succeeded {
            Label("Linked", systemImage: "checkmark.circle.fill")
                .font(.ntInterSemiBold(13, relativeTo: .subheadline))
                .foregroundStyle(NT.Palette.green)
        } else {
            Text("Enter the 6-character code")
                .font(.ntMeta)
                .foregroundStyle(NT.Palette.textTertiary)
        }
    }

    private var codeCells: some View {
        ZStack {
            TextField("", text: codeBinding)
                .keyboardType(.asciiCapable)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .textContentType(.oneTimeCode)
                .focused($focused)
                .foregroundStyle(.clear)
                .tint(.clear)
                .frame(maxWidth: .infinity)
                .opacity(0.02)

            HStack(spacing: Space.sm) {
                ForEach(0..<Self.codeLength, id: \.self) { cell(index: $0) }
            }
            .allowsHitTesting(false)
            .opacity(working ? 0.4 : 1)

            if working {
                ProgressView()
                    .tint(NT.Palette.accent)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if !working && !succeeded { focused = true } }
        .disabled(working || succeeded)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pairing code")
        .accessibilityValue(code.isEmpty ? "Empty" : code.map(String.init).joined(separator: " "))
        .accessibilityHint("Enter the six character code from the website")
    }

    private func cell(index: Int) -> some View {
        let chars = Array(code)
        let char = index < chars.count ? String(chars[index]) : ""
        let isActive = focused && index == code.count && !succeeded && !working
        let borderColor: Color = {
            if succeeded { return NT.Palette.green.opacity(0.6) }
            if errorText != nil { return NT.Palette.red.opacity(0.6) }
            return isActive ? NT.Palette.accent : NT.Palette.border
        }()

        return Text(char.isEmpty ? " " : char)
            .font(.system(size: 24, weight: .semibold, design: .monospaced))
            .foregroundStyle(NT.Palette.textPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(
                RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                    .fill(NT.Palette.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                            .fill(NT.Palette.glassWash)
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: isActive ? 1.5 : 1)
            )
            .overlay {
                if isActive && !reduceMotion {
                    RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                        .stroke(NT.Palette.accent.opacity(0.25), lineWidth: 4)
                        .blur(radius: 4)
                }
            }
            .animation(.easeOut(duration: 0.15), value: isActive)
            .animation(.easeOut(duration: 0.15), value: borderColor)
    }

    private var manualButton: some View {
        Button(action: submit) {
            Text(working ? "Linking\u{2026}" : "Link device")
        }
        .buttonStyle(NTButtonStyle(kind: .primary, fullWidth: true))
        .disabled(working || succeeded || code.count < Self.codeLength)
        .opacity(code.count < Self.codeLength ? 0.5 : 1)
        .animation(.easeOut(duration: 0.15), value: code.count)
    }

    // MARK: Input plumbing

    private var codeBinding: Binding<String> {
        Binding(
            get: { code },
            set: { raw in
                guard !working, !succeeded else { return }
                code = String(raw.uppercased().filter { Self.alphabet.contains($0) }.prefix(Self.codeLength))
            }
        )
    }

    private func fillFromClipboard(_ c: String) {
        clipboardCode = nil
        Haptics.tap()
        code = c // onChange handles the auto-submit
    }

    private func detectClipboard() {
        guard UIPasteboard.general.hasStrings, let raw = UIPasteboard.general.string else { return }
        let candidate = raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard candidate.count == Self.codeLength,
              candidate.allSatisfy({ Self.alphabet.contains($0) }) else { return }
        withAnimation(.easeOut(duration: 0.25)) { clipboardCode = candidate }
    }

    private func triggerShake() {
        guard !reduceMotion else { return }
        withAnimation(.linear(duration: 0.4)) { shake += 1 }
    }

    // MARK: Redeem

    private func submit() {
        let trimmed = code.uppercased()
        guard trimmed.count == Self.codeLength, !working, !succeeded else { return }
        focused = false
        working = true
        errorText = nil
        Task {
            do {
                let follows = try await APIClient.shared.redeem(code: trimmed, pushToStartToken: nil)
                await MainActor.run {
                    working = false
                    succeeded = true
                    Haptics.success()
                }
                try? await Task.sleep(nanoseconds: 650_000_000)
                await MainActor.run { onPaired(follows) }
            } catch {
                await MainActor.run {
                    working = false
                    errorText = (error as? APIError).map(describe) ?? "Could not link. Check the code and try again."
                    Haptics.warning()
                    triggerShake()
                    code = ""
                    lastCount = 0
                    focused = true
                }
            }
        }
    }

    private func describe(_ e: APIError) -> String {
        switch e {
        case .http(410, _): return "That code expired. Generate a new one on the website."
        case .http(409, _): return "That code was already used. Generate a new one."
        case .http(404, _): return "Invalid code. Double-check and try again."
        default: return "Could not link. Please try again."
        }
    }
}

/// Horizontal shake used for the invalid-code feedback. Driven by an
/// incrementing `animatableData` so each error triggers one oscillation.
private struct ShakeEffect: GeometryEffect {
    var travel: CGFloat = 7
    var shakesPerUnit: CGFloat = 3
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        let dx = travel * sin(animatableData * .pi * shakesPerUnit * 2)
        return ProjectionTransform(CGAffineTransform(translationX: dx, y: 0))
    }
}

#Preview {
    NavigationStack {
        PairingView { _ in }
            .navigationTitle("Link iPhone")
            .navigationBarTitleDisplayMode(.inline)
    }
    .preferredColorScheme(.dark)
}
