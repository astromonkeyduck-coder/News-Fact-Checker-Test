import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var identity: DeviceIdentity
    @State private var showPairing = false
    @State private var showUnlinkConfirm = false
    @State private var showWeb = false
    #if DEBUG
    @StateObject private var dataMode = DataMode.shared
    #endif

    var body: some View {
        List {
            pairingSection
            settingsSection
            relationshipSection
            aboutSection
            #if DEBUG
            developerSection
            #endif
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(NT.Palette.ink)
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(NT.Palette.ink, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .tint(NT.Palette.accent)
        .sheet(isPresented: $showPairing) {
            NavigationStack {
                PairingView { _ in
                    showPairing = false
                    Task { try? await APIClient.shared.heartbeat() }
                }
                .navigationTitle("Link iPhone")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Cancel") { showPairing = false } } }
                .background(NT.Palette.ink)
            }
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showWeb) { SafariView(url: Config.webBaseURL) }
        .confirmationDialog("Unlink this iPhone?", isPresented: $showUnlinkConfirm, titleVisibility: .visible) {
            Button("Unlink", role: .destructive) { identity.unpair(); Haptics.warning() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Live Activities you started stay until they end, but this device will stop receiving remote updates and following from the app.")
        }
    }

    // MARK: Developer (DEBUG only)

    #if DEBUG
    @ViewBuilder private var developerSection: some View {
        Section {
            HStack {
                Text("Data mode").foregroundStyle(NT.Palette.textPrimary)
                Spacer()
                Text(dataMode.source.rawValue)
                    .font(.system(.subheadline, design: .monospaced))
                    .foregroundStyle(dataMode.source == .live ? NT.Palette.green : NT.Palette.amber)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Base URL").font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
                Text(dataMode.baseURL)
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(NT.Palette.textTertiary)
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
            }
            if let err = dataMode.lastError {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Last API error").font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
                    Text(err)
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundStyle(NT.Palette.red)
                        .lineLimit(3).fixedSize(horizontal: false, vertical: true)
                }
            }
            Button {
                LiveActivityManager.shared.runDemo(); Haptics.success()
            } label: {
                Label("Run Live Activity demo", systemImage: "bolt.badge.clock")
            }
            Button(role: .destructive) {
                LiveActivityManager.shared.endDemo(); Haptics.warning()
            } label: {
                Label("End Live Activity demo", systemImage: "stop.circle")
            }
        } header: {
            Text("Developer (DEBUG)")
        } footer: {
            Text("Not shipped in Release. Launch with -UseMockData or -UseLiveData to control the source.")
        }
        .listRowBackground(NT.Palette.surface)
    }
    #endif

    // MARK: Pairing

    @ViewBuilder private var pairingSection: some View {
        Section {
            if identity.isPaired {
                if identity.linkType == .account, let profile = identity.linkedProfile {
                    accountLinkedHeader(profile)
                } else {
                    browserLinkedHeader
                }
                deviceStatusRow
                Button(role: .destructive) { showUnlinkConfirm = true } label: {
                    Label("Unlink this iPhone", systemImage: "link.badge.minus")
                }
            } else {
                VStack(alignment: .leading, spacing: Space.md) {
                    HStack(spacing: Space.md) {
                        ZStack {
                            RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                                .fill(NT.Palette.accentMuted)
                                .frame(width: 44, height: 44)
                                .overlay(
                                    RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                                        .strokeBorder(NT.Palette.accent.opacity(0.30), lineWidth: 1)
                                )
                            Image(systemName: "iphone.radiowaves.left.and.right")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(NT.Palette.accent)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Link this iPhone")
                                .font(.ntCardTitle).foregroundStyle(NT.Palette.textPrimary)
                            Text("Sync your follows and use Live Activities.")
                                .font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                    Button { showPairing = true } label: {
                        Label("Enter pairing code", systemImage: "rectangle.and.pencil.and.ellipsis")
                    }
                    .buttonStyle(NTButtonStyle(kind: .primary, fullWidth: true))
                }
                .padding(.vertical, Space.xs)
            }
        } header: {
            Text("This iPhone")
        }
        .listRowBackground(NT.Palette.surface)
    }

    private var settingsSection: some View {
        Section {
            NavigationLink { NotificationsView() } label: {
                Label("Notifications", systemImage: "bell.fill")
            }
        }
        .listRowBackground(NT.Palette.surface)
    }

    private var relationshipSection: some View {
        Section {
            Label {
                Text("Noteworthy News on the web is the full newsroom. This app is your fast, native reader for Home, Live stories, Lock Screen Live Activities, and the Dynamic Island. Following and alerts stay in sync once you link your iPhone.")
                    .font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
            } icon: {
                Image(systemName: "rectangle.connected.to.line.below").foregroundStyle(NT.Palette.textTertiary)
            }
        } header: {
            Text("Web + App")
        }
        .listRowBackground(NT.Palette.surface)
    }

    private var aboutSection: some View {
        Section {
            Button { showWeb = true } label: { Label("Open noteworthynews.co", systemImage: "safari") }
            Link(destination: Config.webBaseURL.appendingPathComponent("privacy.html")) {
                Label("Privacy Policy", systemImage: "hand.raised")
            }
            Link(destination: Config.webBaseURL.appendingPathComponent("terms.html")) {
                Label("Terms", systemImage: "doc.text")
            }
            HStack {
                Label("Version", systemImage: "number")
                Spacer()
                Text(versionString).font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
            }
        } header: {
            Text("About")
        }
        .listRowBackground(NT.Palette.surface)
    }

    // MARK: Linked states

    /// Signed-in web account: avatar + name + email, sourced only from the
    /// server-verified pairing profile.
    @ViewBuilder private func accountLinkedHeader(_ profile: LinkedProfile) -> some View {
        HStack(spacing: Space.md) {
            ProfileAvatar(pictureUrl: profile.pictureUrl, initials: initials(for: profile))
            VStack(alignment: .leading, spacing: 2) {
                Text(profile.name?.nonEmpty ?? profile.email?.nonEmpty ?? "Your account")
                    .font(.ntCardTitle).foregroundStyle(NT.Palette.textPrimary)
                    .lineLimit(1)
                if let email = profile.email?.nonEmpty {
                    Text(email)
                        .font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
                        .lineLimit(1)
                }
                Text("Linked to Noteworthy web account")
                    .font(.ntMeta).foregroundStyle(NT.Palette.textTertiary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, Space.xs)
    }

    /// Anonymous pairing: linked to the browser's follows, no account identity.
    private var browserLinkedHeader: some View {
        HStack(spacing: Space.md) {
            ZStack {
                RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                    .fill(NT.Palette.surfaceRaised)
                    .frame(width: 44, height: 44)
                    .overlay(
                        RoundedRectangle(cornerRadius: NT.Radius.control, style: .continuous)
                            .strokeBorder(NT.Palette.border, lineWidth: 1)
                    )
                Image(systemName: "globe")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(NT.Palette.textSecondary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Linked to this browser")
                    .font(.ntCardTitle).foregroundStyle(NT.Palette.textPrimary)
                Text("Your follows sync with the browser you paired from. Sign in on the web before pairing to link your account.")
                    .font(.ntMeta).foregroundStyle(NT.Palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, Space.xs)
    }

    private var deviceStatusRow: some View {
        HStack(spacing: Space.sm) {
            LivePulse(color: NT.Palette.green, size: 6)
                .frame(width: 14, height: 14)
            Text("Device \(deviceShort)")
                .font(.system(.caption2, design: .monospaced))
                .foregroundStyle(NT.Palette.textTertiary)
            Spacer(minLength: 0)
            Text("ACTIVE")
                .font(.ntInterSemiBold(10, relativeTo: .caption2))
                .tracking(1.0)
                .foregroundStyle(NT.Palette.green)
                .padding(.horizontal, 7).padding(.vertical, 3)
                .background(
                    Capsule().fill(NT.Palette.green.opacity(0.12))
                        .overlay(Capsule().strokeBorder(NT.Palette.green.opacity(0.35), lineWidth: 1))
                )
        }
    }

    // MARK: Helpers

    private func initials(for profile: LinkedProfile) -> String {
        let base = profile.name?.nonEmpty ?? profile.email?.nonEmpty ?? "?"
        let parts = base.split(whereSeparator: { " @._-".contains($0) }).prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }

    private var deviceShort: String { String(identity.deviceUuid.prefix(8)).uppercased() }

    private var versionString: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}

/// Account avatar: loads the verified picture URL, falling back to a clean
/// initials chip on nil or load failure (no broken-image state).
private struct ProfileAvatar: View {
    let pictureUrl: String?
    let initials: String

    private let size: CGFloat = 44

    var body: some View {
        ZStack {
            initialsChip
            if let urlString = pictureUrl?.nonEmpty, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        Color.clear
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            }
        }
        .frame(width: size, height: size)
        .overlay(Circle().strokeBorder(NT.Palette.border, lineWidth: 1))
    }

    private var initialsChip: some View {
        Circle()
            .fill(NT.Palette.accentMuted)
            .overlay(
                Text(initials)
                    .font(.ntInterSemiBold(16, relativeTo: .headline))
                    .foregroundStyle(NT.Palette.accent)
            )
    }
}

private extension String {
    /// Returns nil when the string is empty or whitespace-only.
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

#Preview {
    NavigationStack { ProfileView() }
        .environmentObject(DeviceIdentity.shared)
        .preferredColorScheme(.dark)
}
