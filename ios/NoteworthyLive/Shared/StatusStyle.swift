import SwiftUI

/// Visual mapping for live-story statuses, shared by the app + widget so the
/// Lock Screen, Dynamic Island, and in-app list stay consistent with the web.
enum StatusStyle {
    static func label(_ status: String) -> String {
        switch status {
        case "breaking": return "Breaking"
        case "developing": return "Developing"
        case "verified": return "Verified"
        case "disputed": return "Disputed"
        case "resolved": return "Resolved"
        case "false_report": return "False report"
        default: return "Update"
        }
    }

    static func color(_ status: String) -> Color {
        switch status {
        case "breaking", "false_report": return Color(red: 0.94, green: 0.27, blue: 0.27) // live red
        case "verified": return Color(red: 0.13, green: 0.77, blue: 0.37)                 // success green
        case "developing", "disputed": return Color(red: 0.92, green: 0.70, blue: 0.03)   // warning amber
        case "resolved": return Color.secondary
        default: return Color(red: 0.23, green: 0.55, blue: 0.95)                          // accent blue
        }
    }

    static func systemImage(_ status: String) -> String {
        switch status {
        case "breaking": return "bolt.fill"
        case "developing": return "dot.radiowaves.left.and.right"
        case "verified": return "checkmark.seal.fill"
        case "disputed": return "exclamationmark.triangle.fill"
        case "resolved": return "flag.checkered"
        case "false_report": return "xmark.octagon.fill"
        default: return "newspaper.fill"
        }
    }

    static func relativeTime(_ epoch: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(epoch))
        let fmt = RelativeDateTimeFormatter()
        fmt.unitsStyle = .abbreviated
        return fmt.localizedString(for: date, relativeTo: Date())
    }
}
