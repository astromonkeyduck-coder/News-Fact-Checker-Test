import SwiftUI

/// The real Noteworthy brand type system, using the website's actual fonts
/// (bundled as data-set assets, registered at launch by `BrandFonts`):
///   - **Sora** (geometric sans) → masthead, section/live titles.
///   - **Source Serif 4** (serif) → story/article headlines + body, the core
///     editorial voice.
///   - **Inter** → kickers, labels, meta, timestamps, buttons.
/// All use `relativeTo:` so Dynamic Type still scales them.
extension Font {

    // MARK: Brand font convenience builders (PostScript names)

    static func ntSoraExtraBold(_ size: CGFloat, relativeTo r: TextStyle = .largeTitle) -> Font {
        .custom("Sora-ExtraBold", size: size, relativeTo: r)
    }
    static func ntSoraBold(_ size: CGFloat, relativeTo r: TextStyle = .title3) -> Font {
        .custom("Sora-Bold", size: size, relativeTo: r)
    }
    static func ntSoraSemiBold(_ size: CGFloat, relativeTo r: TextStyle = .headline) -> Font {
        .custom("Sora-SemiBold", size: size, relativeTo: r)
    }
    static func ntSerif(_ size: CGFloat, relativeTo r: TextStyle = .body) -> Font {
        .custom("SourceSerif4-Regular", size: size, relativeTo: r)
    }
    static func ntSerifSemiBold(_ size: CGFloat, relativeTo r: TextStyle = .headline) -> Font {
        .custom("SourceSerif4-SemiBold", size: size, relativeTo: r)
    }
    static func ntInterMedium(_ size: CGFloat, relativeTo r: TextStyle = .caption) -> Font {
        .custom("Inter-Medium", size: size, relativeTo: r)
    }
    static func ntInterSemiBold(_ size: CGFloat, relativeTo r: TextStyle = .caption2) -> Font {
        .custom("Inter-SemiBold", size: size, relativeTo: r)
    }

    // MARK: Semantic tokens

    /// Masthead / large display, Sora ExtraBold.
    static let ntMasthead = Font.ntSoraExtraBold(30, relativeTo: .largeTitle)
    /// Big screen/section title (e.g. "Live"), Sora ExtraBold.
    static let ntSectionTitle = Font.ntSoraExtraBold(24, relativeTo: .title)

    /// Primary story headline, Source Serif 4 SemiBold.
    static let ntHeadline = Font.ntSerifSemiBold(20, relativeTo: .title3)
    /// Card headline, Source Serif 4 SemiBold, compact density.
    static let ntCardTitle = Font.ntSerifSemiBold(17, relativeTo: .headline)
    /// Large editorial headline (article detail), Source Serif 4 SemiBold.
    static let ntDisplaySerif = Font.ntSerifSemiBold(26, relativeTo: .title)

    /// Body / summary text, Source Serif 4.
    static let ntBody = Font.ntSerif(15, relativeTo: .subheadline)
    /// Long-form article body, Source Serif 4.
    static let ntArticleBody = Font.ntSerif(17, relativeTo: .body)
    /// Dek / supporting copy, Source Serif 4.
    static let ntDek = Font.ntSerif(13, relativeTo: .footnote)

    /// Metadata: source, time, counts, Inter Medium.
    static let ntMeta = Font.ntInterMedium(12, relativeTo: .caption)
    /// All-caps kickers / status labels, Inter SemiBold.
    static let ntKicker = Font.ntInterSemiBold(11, relativeTo: .caption2)
    /// Monospaced numerals for tickers/counts.
    static let ntMono = Font.system(.caption, design: .monospaced).weight(.semibold)
}

extension View {
    /// Newsroom kicker: Inter, tracked, uppercased small label.
    func ntKickerStyle(_ color: Color = NT.Palette.textSecondary) -> some View {
        self.font(.ntKicker)
            .tracking(1.3)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }

    /// Tight tracking for big Sora titles.
    func ntTightTitle() -> some View {
        self.tracking(-0.4)
    }
}
