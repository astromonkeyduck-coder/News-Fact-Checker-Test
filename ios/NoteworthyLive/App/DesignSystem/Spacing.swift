import SwiftUI

/// 4pt spacing scale. Compact editorial density, deliberately tighter than the
/// default SwiftUI "lots of whitespace" look.
enum Space {
    static let xxs: CGFloat = 2
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 28
    static let xxxl: CGFloat = 40
}

extension View {
    /// Standard horizontal screen gutter.
    func ntScreenPadding() -> some View {
        self.padding(.horizontal, Space.lg)
    }
}
