# Noteworthy News: publication release review

Working preview: **http://127.0.0.1:4173/**. The isolated implementation is `/private/tmp/noteworthy-publication-release`. Production has not been deployed; live editorial records, subscribers and subscriber messages have not been changed. The original working checkout and its pre-existing edits are preserved.

## What changed

- A shared warm-white, dark-ink and Noteworthy-blue publication design using Source Serif 4 and Inter. News leads the homepage; agency alerts, resources and a compact newsletter section follow. Decorative space imagery, reveal effects, sound effects, automatic video playback and floating AI promotion are absent from the reading pages.
- Complete HTML for homepage, archive and article readers/crawlers through the existing Netlify/Node stack. `/article.html?id=...` and `/article?id=...` keep their original identifiers and canonical links. `/index.html` and `/v2/index.html` are generated reading fallbacks. No framework migration.
- The FDA/USGS failures were a real no-image rendering exception, not absent records or incompatible IDs: `category` was used before declaration. The legacy exception is fixed; the new article route distinguishes a missing record from service failure.
- The archive's search, topic, media format, sort, count and pagination use the same available record set. Filters and page depth live in the URL; reset and zero/five-result pagination work. Current API scope remains the most recent 200 indexed records; the captured public dataset contained 190, with four unsafe imports withheld from lists and 186 displayed. Older direct article IDs remain resolvable by the backend, even when absent from this available archive window.
- Complete recoverable headlines, explicit agency attribution, known/unknown facts, source references, captions, correction actions, independent claim/lifecycle fields and relevant related coverage. The lead links to credited WPLG reporting separately from Noteworthy’s own X distribution. Remote media credits that were not provided are described as unavailable.
- Ambiguous FDA imports retain stable URLs with review notices. The source pipeline validates page type and conflicting product classifications, avoids interpreting “lead to” as lead contamination, and preserves unknown counts. The Whole Foods instruction correction is visible on the article and correction register; its original publication timestamp remains unchanged.
- File-based draft/review/published/corrected workflow with responsible-person attribution, source references near paragraphs, validation/preview/approval gates, private change history, and a public export. Pending revisions keep the previous published version visible. Actual staff biographies require owner details; no identities were invented.
- Shared publication shell on contact, privacy, editorial policies and reader resources. Useful public subscription/preferences guidance, preserved legacy parameterized links, visible preference failures, and a separate tips/corrections route to the existing inbox.
- AI remains available on its own optional page. Its grounding excludes withheld imports, labels agency data, and requires cited registry URLs for source chips. Generated material remains separate from edited coverage. Privacy wording follows the actual provider/upload/logging flow. URL matching does not prove factual support.
- Existing Auth0/profile, newsletter, notification, AdSense and underlying service code remains available. New reading pages reuse the existing cookie-choice format and load advertising only after an accepted choice; local preview suppresses live advertising. Unfilled/short-story placements do not leave large blank ad blocks. Optional AI is not loaded on articles.
- Matching canonical/social metadata and Article/NewsArticle data, RSS, and a supplemental sitemap. No search-ranking or Google News inclusion promise.

## Evidence

- **136 Node tests passed**: original food-safety suite, source/ID/error contracts, workflow, AI grounding, rendering, source attribution, unknown counts, corrections and archive invariants. Raw output: `publication-test-results.txt`.
- `npm run build` passed; both HTML functions bundle for Node 20. Outputs: `publication-build-results.txt` and `publication-function-build.txt`.
- Independent Chromium review captured homepage, archive and article at **375, 390, 768, 1280 and 1440 px**. All tested widths fit; no uncaught script errors or automatic playback. Search, menu/Escape/focus, copy, cookies, image failure, recovery and local signup flows were exercised. See `publication-visual-review.md` and the JSON run records for initial flags and their focused resolution. Initial raw failed assertions are retained rather than erased.
- Newsletter signup used a clearly labeled local no-send endpoint. Preferences/contact behavior used local test fixtures. These tests did not enroll a real subscriber, send an email or change an actual preference record.
- Original V2 HTML measured **47,833 bytes** versus **13,979 bytes** for the initial completed SSR homepage; directly linked first-party CSS measured **103,236 vs 20,748 bytes**. Font and media bytes are excluded. A small subsequent source-correction/anchor change does not affect the measured CSS; final response size is separately recorded in browser metrics.
- A single read-only Chromium capture observed production/local DCL **844/124 ms** and FCP **420/136 ms**. The origins and network paths differ; these are diagnostic observations, **not** an equivalent-hosting speed comparison. Full conditions and observed LCP/CLS are in `publication-browser-metrics.json` and the visual review. No field Core Web Vitals or INP result is claimed.

Before/after images are in `screenshots/`; open `publication-review.html` for the comparison gallery. No image of an untested page is represented as a test result.

## Remaining dependencies

1. Owner-confirmed full staff names, biographies, responsibilities, ownership entity and complete funding details; upstream video/photo credits where missing; editorial decisions for the four flagged imports. The masthead states the limits rather than fabricating details.
2. Owner-provided test accounts and isolated provider configuration for Auth0 callback, Resend enrollment/delivery/unsubscribe, stored preferences, notification/APNs, live AI/voice and actual advertising/consent behavior. Existing signed/legacy inbound routes are preserved, but the current public preferences endpoint uses an unsigned base64-email identifier; migrating that contract needs a deliberate compatibility review.
3. Actual AI retention/deletion procedures and provider account settings. No self-service deletion or universal cleanup guarantee was found. Live AI factual performance and provider reliability are not established by the local citation tests.
4. Manual keyboard/assistive-technology review, zoom/text resizing across browsers, contrast review of loaded third-party media/ads, native mobile browser behavior, and hosted performance verification. This release targets accessible reading but does not claim WCAG certification.
5. The snapshot is historical preview data. Deployed HTML functions read the current public API, while static fallbacks/RSS/sitemap require a refreshed public snapshot and rebuild. No scheduled ingestion or publication jobs were invoked in this pass.

## Run and maintain

From the isolated implementation:

```sh
npm run publication:preview
npm run publication:test
npm run fda:test
npm run publication:build
```

Preview binds localhost port 4173. It has no credentials, never proxies a mutation to production, blocks private draft paths, and labels its signup response as a test. Stop an existing preview before starting another on the same port. Restart it after editing server modules or exporting editorial JSON; browser JS/CSS updates appear on reload.

The editorial guide is `publication-maintenance.md`; the integration audit is `publication-integrations.md`; exact failure/source evidence is `publication-source-audit.md`. Use the CLI to preview, review and correct actual records, export only approved content to `publication/editorial/published.json`, rebuild, then inspect the article and corrections page. Keep drafts and actor files outside the deployment root. Do not refresh publication dates to make old reporting appear new.

Before any deployment, review the supplied patch, the Netlify routing and provider-dependent checks. No production publication is part of this development pass.
# Second iteration: compete on understanding and follow-through

The September 13 development pass adds `/story-so-far/` and three source briefings, linked from the homepage, shared navigation and six existing articles. Each combines an explicit **What changed**, claim-adjacent evidence, specific uncertainties, source dates, and original coverage chronology. Source documents and Noteworthy's own distribution links remain distinct. A later all-clear or ended investigation appears before the old alert headline on the relevant original article.

Optional reading memory stores only a briefing identifier, source date and acknowledged editorial version on the device, after an explicit Remember action. Revisits do not silently mark a newer version read. Same-day meaningful revisions, old-tab protection, corrupt/blocked storage, Forget and Clear are covered by tests. These controls appear only on briefing routes; existing account bookmarks and subscription services are separate. Privacy and maintenance instructions describe the feature.

The competitive strategy cites official Reuters, CNN, AP and BBC documentation. Its proposed reader tests and aviation-follow-up pilot are recommendations, not completed comparative research or staffed services. See `publication-competitive-strategy.md`. The three source briefs were prepared in this development pass and need accountable editorial review as part of deployment review; they are not new field reporting.

Verification for this iteration: all three briefings at 375, 390, 768, 1280 and 1440px had no horizontal overflow and retained evidence links, change explanations and unknowns. Browser checks exercised mobile navigation, Remember/reload, index status, Clear/reload, the old-recall-to-final-outcome path and jump navigation. No browser error logs were recorded for this journey. The current Node test count is in `publication-test-results.txt`; rendered/interaction results are in `publication-brief-browser-results.json`.

Clean viewport screenshots are `screenshots/briefing-miami-desktop.png`, `briefing-miami-mobile.png`, `briefing-evidence-desktop.png` and `briefing-evidence-mobile.png`. Initial full-page browser captures had stitching artifacts; those files were replaced with viewport captures. DOM checks confirmed one timeline, one memory section and one footer. Existing first-release before/after images remain in the gallery. No new competitive speed or accessibility-compliance claim is made.

Static briefing routes and sitemap entries are generated by `publication:build`; original article functions still resolve the same IDs. Production deployment, live subscriber messages and live editorial writes remain outside this development pass. The durable review overlay and patch include the full first release plus these additions.
