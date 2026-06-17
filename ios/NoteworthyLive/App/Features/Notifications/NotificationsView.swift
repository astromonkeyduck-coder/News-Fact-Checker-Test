import SwiftUI
import UserNotifications
import ActivityKit

struct NotificationsView: View {
    @EnvironmentObject var notifications: NotificationManager
    @EnvironmentObject var prefsStore: NotificationPreferencesStore
    @ObservedObject private var identity = DeviceIdentity.shared
    @Environment(\.dismiss) private var dismiss

    private var prefs: Binding<NotificationPreferences> { $prefsStore.prefs }

    private var liveActivitiesEnabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    var body: some View {
        List {
            systemSection
            deliverySection
            alertsSection
            quietHoursSection
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(NT.Palette.ink)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
        }
        .toolbarBackground(NT.Palette.ink, for: .navigationBar)
        .onAppear { notifications.refresh() }
        .tint(NT.Palette.accent)
    }

    // MARK: System state

    private var systemSection: some View {
        Section {
            HStack {
                Label("Push notifications", systemImage: "bell.fill")
                Spacer()
                statusBadge
            }
            if notifications.authorizationStatus == .denied {
                Button { notifications.openSystemSettings() } label: {
                    Label("Open iOS Settings to enable", systemImage: "gear")
                }
            } else if notifications.authorizationStatus == .notDetermined {
                Button { Task { await notifications.requestAuthorization() } } label: {
                    Label("Turn on notifications", systemImage: "bell.badge")
                }
            }
            HStack {
                Label("Live Activities", systemImage: "platter.filled.bottom.iphone")
                Spacer()
                Text(liveActivitiesEnabled ? "Available" : "Off")
                    .font(.ntMeta)
                    .foregroundStyle(liveActivitiesEnabled ? NT.Palette.green : NT.Palette.amber)
            }
        } header: {
            Text("Device")
        } footer: {
            Text(liveActivitiesEnabled
                 ? "Lock Screen and Dynamic Island Live Activities are available on this iPhone."
                 : "Turn on Live Activities in iOS Settings > Noteworthy to use Lock Screen and Dynamic Island.")
        }
        .listRowBackground(NT.Palette.surface)
    }

    private var statusBadge: some View {
        let (text, color): (String, Color) = {
            switch notifications.authorizationStatus {
            case .authorized, .provisional, .ephemeral: return ("On", NT.Palette.green)
            case .denied: return ("Off", NT.Palette.red)
            default: return ("Not set", NT.Palette.amber)
            }
        }()
        return Text(text).font(.ntMeta).foregroundStyle(color)
    }

    // MARK: Delivery status

    private var deliverySection: some View {
        Section {
            HStack {
                Label("Device registered", systemImage: "iphone.radiowaves.left.and.right")
                Spacer()
                Text(identity.hasApnsToken ? "Yes" : "No")
                    .font(.ntMeta)
                    .foregroundStyle(identity.hasApnsToken ? NT.Palette.green : NT.Palette.amber)
            }
            HStack {
                Label("Preferences", systemImage: "arrow.triangle.2.circlepath")
                Spacer()
                syncBadge
            }
        } header: {
            Text("Delivery")
        } footer: {
            Text(identity.hasApnsToken
                 ? "This iPhone is registered to receive Noteworthy push alerts. Your preferences sync to the newsroom."
                 : "Turn on notifications above to register this iPhone for push alerts.")
        }
        .listRowBackground(NT.Palette.surface)
    }

    private var syncBadge: some View {
        let (text, color): (String, Color) = {
            switch prefsStore.syncState {
            case .synced: return ("Synced", NT.Palette.green)
            case .pending: return ("Syncing…", NT.Palette.amber)
            case .failed: return ("Failed", NT.Palette.red)
            case .idle: return (identity.isPaired ? "—" : "Local", NT.Palette.textTertiary)
            }
        }()
        return Text(text).font(.ntMeta).foregroundStyle(color)
    }

    // MARK: Alert types

    private var alertsSection: some View {
        Section {
            Toggle(isOn: prefs.masterEnabled) { Label("All alerts", systemImage: "app.badge") }
            Toggle(isOn: prefs.breakingNews) { Label("Breaking news", systemImage: "bolt.fill") }
                .disabled(!prefsStore.prefs.masterEnabled)
            Toggle(isOn: prefs.liveStoryUpdates) { Label("Live story updates", systemImage: "dot.radiowaves.left.and.right") }
                .disabled(!prefsStore.prefs.masterEnabled)
            Toggle(isOn: prefs.finalUpdates) { Label("Final & corrections", systemImage: "checkmark.seal") }
                .disabled(!prefsStore.prefs.masterEnabled)
            Toggle(isOn: prefs.allowTimeSensitive) { Label("Time-Sensitive urgent alerts", systemImage: "exclamationmark.bubble") }
                .disabled(!prefsStore.prefs.masterEnabled)
        } header: {
            Text("Alerts")
        } footer: {
            Text("Time-Sensitive is used only for genuinely urgent or final updates so they can break through Focus. Routine updates stay quiet.")
        }
        .listRowBackground(NT.Palette.surface)
        .tint(NT.Palette.accent)
    }

    // MARK: Quiet hours

    private var quietHoursSection: some View {
        Section {
            Toggle(isOn: prefs.quietHoursEnabled) { Label("Quiet hours", systemImage: "moon.fill") }
            if prefsStore.prefs.quietHoursEnabled {
                Stepper(value: prefs.quietHoursStartHour, in: 0...23) {
                    HStack { Text("From"); Spacer(); Text(hourLabel(prefsStore.prefs.quietHoursStartHour)).foregroundStyle(NT.Palette.textSecondary) }
                }
                Stepper(value: prefs.quietHoursEndHour, in: 0...23) {
                    HStack { Text("Until"); Spacer(); Text(hourLabel(prefsStore.prefs.quietHoursEndHour)).foregroundStyle(NT.Palette.textSecondary) }
                }
            }
        } header: {
            Text("Quiet hours")
        } footer: {
            Text("During quiet hours, routine updates stay silent on this iPhone. Urgent and final updates still alert.")
        }
        .listRowBackground(NT.Palette.surface)
        .tint(NT.Palette.accent)
    }

    private func hourLabel(_ hour: Int) -> String {
        var comps = DateComponents(); comps.hour = hour
        let date = Calendar.current.date(from: comps) ?? Date()
        let df = DateFormatter(); df.dateFormat = "h a"
        return df.string(from: date)
    }
}

#Preview {
    NavigationStack { NotificationsView() }
        .environmentObject(NotificationManager.shared)
        .environmentObject(NotificationPreferencesStore.shared)
}
