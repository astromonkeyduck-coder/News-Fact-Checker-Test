import WidgetKit
import SwiftUI

/// Widget extension entry point. Contains only the Live Activity (no home-screen
/// widgets in Phase 2).
@main
struct LiveStoryWidgetBundle: WidgetBundle {
    var body: some Widget {
        LiveStoryLiveActivity()
    }
}
