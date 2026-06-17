# iOS Future Design + Polish Backlog

The Milestone 1 visual direction is **frozen** (navy/blue brand, Sora/Source Serif/Inter type, NW monogram icon, editorial cards, glass Live surface). This file collects redesign and polish ideas that are intentionally **deferred** so we stop the endless-redesign loop and ship M1. Nothing here is a release blocker.

Pull items from here into a future milestone deliberately, not ad hoc.

## Home feed
- Section personalization (followed topics, "For you" vs "Latest").
- Pull-to-refresh with a branded refresh control / subtle ticker.
- Category/topic header chips on Home (currently only in Explore).
- Larger lead-story treatment variants (full-bleed photo hero when a high-quality image exists).
- Inline "Developing Now" auto-advancing rail with live pulse density tuning.
- Smarter dedupe/grouping of near-duplicate wire items.
- Sticky condensed masthead on scroll (currently the masthead scrolls away).

## Live Now / Live Stories
- Per-update unread indicators and "X new updates" since last visit.
- Severity-driven card emphasis (size/contrast scales with severity).
- Filter/sort (followed first, by status, by recency).
- Compact vs comfortable density toggle.
- Live region count + "viewers/followers" live counter animation.
- Empty state with suggested stories to follow.

## Story Detail (reading experience)
- Real article body formatting (paragraph rhythm, pull quotes, inline media, links) once the content pipeline exposes rich body.
- Reading progress indicator and estimated read time.
- Inline source attribution chips with favicons.
- Related stories / "more on this" section.
- Text size control independent of system Dynamic Type.
- Share-as-image / quote-share.

## Onboarding
- Optional 5-10s lightweight, abstract background motion loop (with a graceful static fallback; no large asset).
- Animated transitions between slides (subtle parallax on the preview cards).
- A/B different value framings.
- Optional topic-pick step (defer until topic prefs exist on the backend).

## App icon / final brand assets
- Replace the current generated NW tile with a hand-built vector NW lockup from a designer (current is AI-generated then squared).
- Full icon set incl. dark/tinted/clear iOS 18 variants.
- Alternate marketing/notification icons.
- A proper SVG master for the wordmark + monogram.

## Splash / loading / video background
- Subtle motion on the splash mark (already minimal); explore a one-shot draw-on of the NW.
- Optional compressed video/Lottie launch loop with static fallback.
- Skeletons that match each screen's final layout 1:1.

## Motion / transitions
- Shared-element transition from feed card -> Story Detail (matched geometry).
- Tab-change crossfades; refined navigation push timing.
- Live pulse easing pass; reduce-motion variants for every animation.
- Haptic choreography review (currently light/select/success/warning).

## Real media / video presentation
- Inline video playback in Story Detail (currently `videoUrl` is captured but plays via the web/source).
- Autoplay-muted video previews in the feed (data/battery aware).
- Image aspect-ratio aware cards; blurhash/LQIP placeholders instead of the gray fallback.
- Gallery / multi-image posts.
- Caption + credit treatment for media.

## iPad / adaptive layout
- Multi-column feed and split-view (list + detail) on iPad/large width.
- Regular-size-class layouts; max content width on Pro Max to avoid stretch.
- Keyboard shortcuts and pointer support.
- Stage Manager / external display sanity.

## watchOS / visionOS / tvOS (future platforms)
- watchOS: glanceable live-story complications + Smart Stack, follow/alerts.
- visionOS: spatial Live timeline, ornament-based controls.
- tvOS: "Live now" lean-back wall for newsrooms/displays.

## Intentionally deferred from Milestone 1
- Standard APNs push notifications + Notification Service Extension dispatch (Milestone 2).
- Server-synced notification preferences and quiet hours (currently device-local).
- Server-side saved stories sync (currently device-local).
- Server-side full-text search (Explore search is currently client-side over the loaded feed).
- Per-topic mute / topic preferences backend.
- Backend hardening: rate limits on public mutations, pairing-code sweeper, stale-token cleanup, iOS dispatch audit rows (see IOS_M2_BACKLOG.md).
- Automated tests / CI.
- TestFlight + App Store submission.
- Universal Links / Associated Domains (currently custom `noteworthylive://` scheme only).
- Unify the editorial-card and glass-Live card languages into one system.
