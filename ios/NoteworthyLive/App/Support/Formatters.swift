import Foundation

/// Date + number formatting shared across screens. Parses the ISO-8601 strings
/// the backend returns (with or without fractional seconds) and renders compact,
/// newsroom-style relative times ("2m", "3h", "Jun 14").
enum Formatters {

    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let fallback: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return f
    }()

    static func date(from string: String?) -> Date? {
        guard let s = string, !s.isEmpty else { return nil }
        return isoFractional.date(from: s) ?? iso.date(from: s) ?? fallback.date(from: s)
    }

    /// Compact relative age: "Just now", "4m", "3h", or an abbreviated date.
    static func relative(_ string: String?) -> String {
        guard let date = date(from: string) else { return "" }
        return relative(date)
    }

    static func relative(_ date: Date) -> String {
        let secs = Date().timeIntervalSince(date)
        if secs < 45 { return "Just now" }
        let mins = Int(secs / 60)
        if mins < 60 { return "\(mins)m" }
        let hours = mins / 60
        if hours < 24 { return "\(hours)h" }
        let days = hours / 24
        if days < 7 { return "\(days)d" }
        let df = DateFormatter()
        df.locale = .current
        df.dateFormat = Calendar.current.isDate(date, equalTo: Date(), toGranularity: .year) ? "MMM d" : "MMM d, yyyy"
        return df.string(from: date)
    }

    /// Absolute, accessible time string for VoiceOver and detail headers.
    static func absolute(_ string: String?) -> String {
        guard let date = date(from: string) else { return "" }
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .short
        return df.string(from: date)
    }

    static func count(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
        return String(n)
    }
}
