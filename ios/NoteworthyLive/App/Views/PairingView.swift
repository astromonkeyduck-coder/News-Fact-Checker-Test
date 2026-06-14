import SwiftUI

/// Shown until the device is paired. The user generates a code on the website
/// (Notification settings → "Open in the iOS app") and enters it here.
struct PairingView: View {
    @State private var code = ""
    @State private var working = false
    @State private var errorText: String?

    var onPaired: ([FollowedStory]) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "bolt.horizontal.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.tint)

            Text("Link this iPhone")
                .font(.title.bold())

            Text("On noteworthynews.com open Notification settings, tap \u{201C}Open in the iOS app\u{201D}, and enter the code below to bring your followed live stories here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            TextField("Pairing code", text: $code)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .multilineTextAlignment(.center)
                .font(.system(.title2, design: .monospaced).weight(.bold))
                .padding()
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

            if let errorText {
                Text(errorText).font(.footnote).foregroundStyle(.red)
            }

            Button(action: redeem) {
                if working { ProgressView() } else { Text("Link device").bold() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(working || code.trimmingCharacters(in: .whitespaces).count < 4)

            Spacer()
        }
        .padding()
    }

    private func redeem() {
        working = true
        errorText = nil
        Task {
            do {
                // Pass the push-to-start token if we already have one cached.
                let follows = try await APIClient.shared.redeem(
                    code: code.trimmingCharacters(in: .whitespaces).uppercased(),
                    pushToStartToken: nil
                )
                await MainActor.run { onPaired(follows) }
            } catch {
                await MainActor.run {
                    errorText = (error as? APIError).map(describe) ?? "Could not link. Check the code and try again."
                    working = false
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
