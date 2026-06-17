import SwiftUI

/// The tabbed app shell. Five tabs, each a NavigationStack so taps and deep
/// links push native Story Detail. Dark-mode-first; the tab bar is tinted with
/// the Noteworthy red accent.
struct AppShell: View {
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var identity: DeviceIdentity
    @EnvironmentObject var reachability: Reachability

    var body: some View {
        TabView(selection: $router.selectedTab) {
            NavigationStack(path: $router.homePath) {
                HomeView()
                    .storyDestinations()
            }
            .tabItem { Label("Home", systemImage: "house.fill") }
            .tag(AppRouter.Tab.home)

            NavigationStack(path: $router.livePath) {
                LiveView()
                    .storyDestinations()
            }
            .tabItem { Label("Live", systemImage: "dot.radiowaves.left.and.right") }
            .tag(AppRouter.Tab.live)

            NavigationStack(path: $router.searchPath) {
                SearchView()
                    .storyDestinations()
            }
            .tabItem { Label("Explore", systemImage: "magnifyingglass") }
            .tag(AppRouter.Tab.search)

            NavigationStack(path: $router.savedPath) {
                SavedView()
                    .storyDestinations()
            }
            .tabItem { Label("Saved", systemImage: "bookmark.fill") }
            .tag(AppRouter.Tab.saved)

            NavigationStack {
                ProfileView()
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }
            .tag(AppRouter.Tab.profile)
        }
        .tint(NT.Palette.accent)
    }
}

/// Shared navigation destinations so every tab resolves a StoryRoute the same
/// way (native post detail or native live-story detail).
private struct StoryDestinations: ViewModifier {
    func body(content: Content) -> some View {
        content.navigationDestination(for: StoryRoute.self) { route in
            switch route {
            case .post(let item):
                StoryDetailView(source: .post(item))
            case .live(let slug):
                StoryDetailView(source: .live(slug: slug))
            }
        }
    }
}

extension View {
    func storyDestinations() -> some View { modifier(StoryDestinations()) }
}
