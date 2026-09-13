# Independent visual and usability review

Reviewed production at https://noteworthynews.co on 2026-09-12 using the Codex in-app browser. This review owns no frontend edits. Initial checks used 1440 × 960 and 390 × 844 viewports. Initial loading snapshots were followed by settled content checks; blank loading slots were not classified as missing reporting.

## Observed baseline defects

| Route / reproduction | Settled evidence | Reader impact |
| --- | --- | --- |
| `/` at 1440px | Astronaut, Earth background, star field and moving wire coexist with large slogan and small lead title. Screenshot `screenshots/before-home-desktop.png`. | Decorative and promotional content competes with journalism. |
| `/` at 390px | Brand slogan, calls to action and app promotion fill the first viewport. Lead headline begins at y=842 in an 844px viewport, after its large video. Screenshot `screenshots/before-home-mobile.png`. | Actual reporting headline is effectively below the fold. |
| `/` lead video at 390px | Read-only DOM inspection observed one of five video elements playing (`paused: false`), muted, with no user play interaction. | Playback starts without a reader action. |
| `/archive`, enter `Miami` | After search settles: `Showing 5 of 5 stories` plus `Load more stories (166)`. Screenshot `screenshots/before-archive-miami.png`. | Pagination reflects the unfiltered dataset. |
| `/archive`, enter `zzzzzz-no-results` | Settled `No stories match` and `Clear filters`, with the same `Load more stories (166)`. Screenshot `screenshots/before-archive-zero.png`. | Empty search retains an unusable pagination action. |
| `/article.html?id=fda-page-1b6014ef53e61d57` | Loading settles to `Could not load this story` and a generic retry message. Screenshot `screenshots/before-fda-article.png`. | Homepage/archived alert cannot render. Failure UI does not identify whether the record is unavailable or temporarily inaccessible. |
| `/article.html?id=usgs-us7000tgrk` | Loading settles to the same generic failure. Screenshot `screenshots/before-usgs-article.png`. | Latest earthquake card cannot render. |
| `/article.html?id=2096717577204502980` | H1 ends with literal `the she…`; body has complete `the sheriff’s office says.` Screenshot `screenshots/before-news-article.png`. | Full title is recoverable from the existing body. |
| Same lead article | Source trail cites only Noteworthy's own X post while adjacent `How we know` says claims trace to official data. | Distribution link is presented without a visible underlying evidence limitation. |
| Homepage alerts | Cyclospora mixed-language research-like phrase is labeled `Outbreak`; epinephrine injection is labeled `Food Recall`; multiple cards show `0 sick`. | Labels and facts require source validation (root/data reviewer investigating). These are observed presentations, not yet independent confirmation of the source facts. |
| Shared pages | Homepage, archive and article use different primary links; article's correction mailto has only a generic subject. AI hint card and launcher float together over the lower right. | Navigation varies and correction messages lack the article context. |
| Lead article console | Repeated `[Auth0] Buttons not found in DOM yet, retrying...` warnings. | Nonblocking in the observed sample; repeated initialization should be checked when simplifying integration loading. |

## Baseline limits

- Baseline captures document the current rendered state, not an earlier historical audit.
- No production records, newsletter subscriptions or account settings were changed.
- This browser interface exposes screenshots, DOM inspection and console logs, but no documented network/performance trace capture. No Lighthouse/Core Web Vitals score is claimed. DOM observation did confirm 390px layout width equals 390px scroll width on the sampled homepage.
- FDA/USGS failure cause is deferred to the independent source/data review; the browser confirms failure UI after loading, not the storage/API root cause.

## Release review

Completed against the local implementation preview. The results and test conditions follow below.

## Independent rendered release checks — 2026-09-13

The app browser connection became unavailable during the follow-up (`No browser is available` after documented recovery). Release screenshots and interaction checks therefore used a fresh, isolated headless Chromium 146 test instance against `http://127.0.0.1:4173`. No existing browser profile, cookies, or account session was reused. The repository's default Chromium 121 failed to launch; the newer already-installed test binary worked. These are local headless checks, not claims of verification in Safari, Firefox or the app browser.

The reusable runner is `scripts/test-publication-browser.js`. Its main pass captured homepage, article and archive at 375, 390, 768, 1280 and 1440px, plus sampled USGS, FDA review notice and FDA recall pages. It made 77 checks. Two initial flags were investigated: the copy confirmation was read before its asynchronous result (fixed in the test with an explicit wait); the sampled Whole Foods record's zero count was supported by the FDA's express statement that no illnesses had been reported, so it was not an unknown-field default. Unknown-count verification now uses the broccoli-sprout recall record, whose visible illness count is `Not reported`.

A separate focused pass made 22 successful checks, including those affected cases and five shared pages at 375px. See `publication-browser-results.json` for the initial run and `publication-browser-focused-results.json` for the focused results. Initial failed assertions remain in the raw first-run record for transparency; the source/count test's original premise was corrected, and the asynchronous copy result passed after waiting.

### Verified behavior

- No horizontal overflow in any tested homepage, news article, archive or sampled alert viewport. The full main headline is visible within the 390 × 844 homepage screenshot (starts around y=497; ends around y=712), versus the production baseline beginning around y=842.
- Warm reading surfaces, restrained blue accents, consistent serif headlines and navigation are visible in actual screenshots. The desktop lead is prominent; the small mobile menu expands in document flow and closes with Escape while restoring focus.
- All sampled article routes return a complete page. The USGS example shows agency attribution and structured magnitude/depth/location fields. The ambiguous FDA link shows an editorial review notice instead of the prior unsupported outbreak assertion. News H1 is complete, and its correction action includes the article URL.
- Archive Miami search has exactly five matches and no pagination. Miami plus video has two. Combined incompatible topic and format produce zero and hide pagination. Reset clears the inputs; loading more retains category, grows the count and survives a reload through URL query state.
- Homepage has no video elements; article video is paused with reader controls and no autoplay at every tested width. No fixed overlays were observed in the new core templates.
- Cookie preferences remain in normal document flow. Footer settings focus the preference control, rejection dismisses it, and settings reopen it. The browser tests did not accept optional advertising cookies.
- Local newsletter form returns `Test signup completed. No email was sent and no subscriber was added.` No live subscriber mutation or email was attempted.
- Copy-link confirmation settles successfully. A missing article presents a specific not-found message and archive recovery.
- An independent unavailable-image test exposed missing error listeners on archive results regenerated by JavaScript. The frontend owner added a delegated image-error handler. Repeating that case with image requests blocked now produces explicit `Image unavailable` fallbacks and usable complete article links.
- Shared masthead, subscriptions, contact, resources and privacy pages fit 375px. The subscription comparison table remains within the viewport. No uncaught JavaScript exceptions were recorded in either run.

### Remaining scope limits

- Live authentication, optional AI calls, subscriber delivery and signed preference-token transactions were intentionally not exercised. The local signup endpoint is a no-send mock.
- These checks cover Chromium rendering and documented UI flows, not a comprehensive accessibility audit or assistive-technology certification.
- Original media availability depends on its remote provider. The failure-state test verifies a readable fallback, not future uptime of those sources.
- The initial app-browser baseline did not expose a documented performance trace surface. Additional read-only headless before/after timing measurements are recorded separately, with their different origins and network conditions disclosed.

### Final page verification

The final targeted pass made 16 successful checks after the FDA wording, recall action, correction history and static preview safety flag changed. The FDA body now says `No illnesses had been reported in the source announcement`, preserving the distinction between no reports and an assertion that no cases exist. The source owner verified this against the [FDA Whole Foods recall announcement](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/whole-foods-market-issues-allergy-alert-undeclared-egg-cabricharme-cheese). The contact page now requests the article URL and supporting evidence instead of claiming an unverified inbox priority. Its `data-preview` safety flag is true even though the retained static shell has no preview banner.

Full-page visual inspection then exposed an additional FDA action inconsistency: the generic deck/body action `Return for a refund` conflicts with the included source text saying customers need not return the product and should destroy it. The frontend/source owner corrected this and the affected pages were retested; see the final source-action follow-up below.

### Performance observations

`publication-browser-metrics.json` records one settled production reading capture and one local release capture, both at 1440 × 960 in Chromium 146, with HTTP cache disabled and all non-GET requests blocked. Capture waits until an actual article link is visible; the production skeleton is not counted as permanently missing reporting. Raw navigation numbers are from this individual run.

| Measurement | Production homepage | Local release homepage |
| --- | ---: | ---: |
| DOM content loaded | 844 ms | 124 ms |
| First contentful paint | 420 ms | 136 ms |
| Latest observed LCP candidate | 456 ms | 144 ms |
| Observed layout shift total | 0.054 | 0.010 |
| HTML decoded body size | 48,254 bytes | 14,086 bytes |
| Resource entries at capture | 41 | 13 |
| Script resource entries | 17 | 4 |
| Video resource entries | 5 | 0 |

These timings compare a remote production origin with localhost, not two equivalently hosted deployments. They are diagnostic observations, not a causal speed-improvement percentage or field Core Web Vitals result. Cross-origin resource timings can report zero bytes, so the recorded `knownTransferredBytes` is incomplete and is not used as total page weight. Browser LCP candidates do not directly measure when readers have understood a news headline. No INP or real-user performance score was measured. Compare the build owner's on-disk payload measurements for a controlled code-size comparison.

The settled comparison screenshots are `screenshots/production-before-metrics-1440.png` and `screenshots/local-release-after-metrics-1440.png`. The earlier app-browser baseline screenshots remain the original audit evidence.

### Repeating the browser checks

Run the local preview first, then `node scripts/test-publication-browser.js`. The runner accepts `--focused` for copy/image/shared-page follow-up, `--final-pages` for the final FDA/contact changes, and `--metrics` for the explicitly read-only public production/local timing comparison. Set `PUBLICATION_TEST_CHROME` to a current Chrome for Testing executable if the Puppeteer package's default binary is incompatible with the host. `PUBLICATION_PREVIEW_URL` accepts only localhost or 127.0.0.1 HTTP origins. Ordinary tests reject third-party non-GET requests; metrics reject all non-GET requests. Profiles are new temporary directories and are removed when the browser closes.


### Final source-action follow-up — resolved

The recall deck and current body now say `Destroy the affected product`; the refund-with-valid-receipt advice appears separately. An article-level correction record preserves the earlier `Return for a refund` wording, explains why it was misleading, and records the actual review time, September 13, 2026 at 11:03 AM EDT. The original publication timestamp remains September 11, 2026. The same correction appears on the public corrections page and links back to the article.

The final targeted run passed all 16 checks with no uncaught JavaScript errors. Both the full FDA article and the corrections page were visually inspected from their final screenshots. The contradiction assertion examines current deck/body copy while leaving the historical correction record intact. Evidence: `publication-browser-final-pages.json`, `screenshots/after-fda-recall-final-full.png`, and `screenshots/after-corrections-final-full.png`.

No consequential layout or interaction finding remains open within this review's tested scope. Live delivery, authentication, signed preference flows, other browser engines, and assistive-technology verification remain outside these headless local checks as described above.


## Second iteration: source briefings

The independent reviewer inspected clean desktop and mobile viewport captures of the new briefings and evidence layout. No material visual issue remained in that reviewed scope. Initial full-page capture stitching duplicated parts of the image; clean viewport files replaced those captures. Actual DOM counts were one timeline, one reading-memory section and one footer.

The separate reviewer added 11 tests for calendar dates and original timestamps, current outcomes before old alerts, no-JavaScript evidence and correction routes, unique jump targets, escaping, safe slugs, current canonical/static/preview routes, and the explicit reading-version contract. An unsafe edited slug now fails validation instead of being interpolated into a link. The root browser checks are recorded in publication-brief-browser-results.json: three briefings across five widths, memory/return/clear, mobile navigation, and original-article context. A complete screen-reader audit and comparative reader study remain unperformed.
