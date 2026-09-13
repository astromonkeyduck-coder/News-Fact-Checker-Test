# Publication source audit — September 12, 2026

Scope: read-only public APIs and source pages, repository inspection, isolated development projection and parser repairs. No production records were edited, no jobs triggered, and no subscriber messages sent.

## Reproduced article failure

The public endpoint `/.netlify/functions/posts-read?id=<id>` returned HTTP 200 and one real record for **each** sampled ID:

- `fda-page-1b6014ef53e61d57`
- `usgs-us7000tgrk`
- `2096717577204502980`

The first two have no image. In the existing `src/components/article-loader.js` image fallback, `${title} ${category}` runs before `const category` is initialized. Executing this exact block with the real USGS record produces `ReferenceError: Cannot access 'category' before initialization`. The catch renders “Could not load this story.” The numeric lead has an image and bypasses the faulty branch. **The observed failure is a rendering error, not a missing source record or evidence of an incompatible ID format.** The category declaration now precedes the image fallback, and the new server rendering path replaces that dependency. A regression executes the real legacy fallback block with both previously failing records.

A separate confirmed backend problem: `postStore.readPost` and `readIndex` previously converted every storage exception into “missing.” The preview function also returned HTTP 200 for missing records with a current generated date. This release adds strict storage reads, validated string IDs, canonical `post-` / `.json` handling, and both directions of the legacy USGS/`eq-` alias. `posts-read` returns 404 for absence, 400 for invalid identifiers, and 503 with `no-store` plus `Retry-After` for temporary storage failure. No internal error detail is sent publicly. Numeric snowflake IDs remain strings.

## Cyclospora: information page misread as an outbreak

[The original FDA document](https://www.fda.gov/food/foodborne-pathogens/cyclospora-prevention-response-and-research-action-plan) is a research and prevention action plan. Its Spanish webinar link was extracted as a product. The mixed language is therefore evidence of a wrong page/field extraction, rather than a headline translation problem. This page does not substantiate the generated product-linked outbreak notice.

Changes:

- Research/information URL and title signals are rejected by the food-alert scope gate.
- Unrecognized page layouts no longer extract products or outcome counts from the generic page body. They carry a review warning.
- Unknown layouts and contradictory product identity force review before publication. Existing published candidates with new review reasons no longer bypass validation merely because material fields are unchanged.
- The legacy ID resolves to a source-linked editorial review notice. The bad claims and structured metrics are withheld from that response and the record is excluded from homepage/archive listings.

## Epinephrine: contradictory upstream taxonomy and false hazard

[The FDA announcement](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/american-regent-inc-issues-voluntary-nationwide-recall-three-lots-epinephrine-injection-usp-30-mg-30) describes epinephrine injection recalled for particulate matter and sterility concerns. At inspection, the source page itself categorizes this as Food & Beverages. The pipeline allowed that label to override the medication identity. Separately, its hazard regex matched the verb in “lead to” as the chemical lead.

Changes:

- Concrete medication/device/supplement product identity conflicting with a food taxonomy label now queues review.
- The chemical classifier excludes the verb construction “lead to.”
- The medication's legacy food-alert projection becomes a stable-ID review notice, with its unverified generated hazard removed.
- Similar legacy supplement and animal-product imports are included in the development review manifest. Their final editorial treatment requires source review.

Absent illnesses, hospitalizations and deaths remain `null`. An explicit official zero remains zero. The previous parser already preserved this distinction; new regression checks protect it. Missing source status now remains `unknown`, rather than defaulting to an active emergency.

## Complete lead title and accountable attribution

The original complete wording survives in the lead record's `story` and `text`; only its stored `title` was truncated. `lib/contentNormalize.js` now recovers a complete original line only if it begins with the entire stored title prefix. Unrelated body text cannot supply an invented ending. Full headlines have no implicit length cap; optional card-specific shortening remains available. The X import writer no longer truncates stored titles. FDA headline product names also retain their full text. Five legacy FDA headings recover exact product-prefix matches from the intact source summary. The Clover Hill headline is restored from the complete heading on its linked FDA announcement; the source product field itself is cut off, so no missing product list is guessed.

The original update attributes the death/injury claim to the sheriff's office. [WPLG Local 10's reporting from the September 6 news conference](https://www.local10.com/news/local/2026/09/06/cargo-plane-crashes-after-going-off-miami-international-airport-runway/) supports that attribution. The projection adds a clearly credited supporting reference without silently rewriting the report or refreshing its publication date. Noteworthy's X URL remains the original distribution link. The public record does not supply an upstream video creator credit; the UI must disclose that limitation rather than infer ownership.

## Snapshot and review workflow

- `publication/data/posts.json`: **190 unmodified public API records**, frozen for the isolated preview.
- `publication/data/provenance.json`: endpoint, exact capture timestamp, SHA-256, checked IDs, reviewed source links and limits.
- `publication/data/review-queue.json`: four development-only review candidates with preserved IDs and source URLs.
- `lib/publicationSourceQuality.js`: UMD read-time quality projection shared between API and browser/server rendering. Raw snapshot remains unchanged.

The API is capped at 200 indexed records. This release's archive operates consistently on the available dataset; it does not claim to recover the complete historical publication. Snapshot content remains historical source material and is not independently reverified in bulk. Old earthquake assets include internal algorithmic impact/aftershock estimates; they are not official agency evidence and should not be displayed as confirmed facts.

For an ambiguous import, examine the actual source page type, product, hazard and count evidence in the existing FDA admin review queue before approving. Preserve the stable post ID and first publication time. Publish a substantive correction with before/after wording and its own timestamp when correcting an already public claim; an ordinary source update is not a correction. The live FDA queue and old live records require an explicitly authorized follow-up after deployment review; this development pass changes only code, local manifests and public projections.

## Verification

`node --test tests/publication-source.test.js tests/food-safety/*.test.js` — **94 passed, 0 failed**.

Coverage includes real snapshot source-ID lookup; legacy keys and aliases; missing/invalid/transient states; private drafts and review records; exact full-headline recovery; wrong-source legacy notices and feed exclusions; research-page extraction rejection; contradictory FDA taxonomy review; the “lead to” false positive; complete FDA product headlines; and null versus explicit-zero counts. The existing 83 FDA parser/API tests also pass.

No authenticated ingestion replay or publication was run. Root/visual reviewer owns actual rendered page verification, media behavior and responsive checks; backend test success alone is not a claim of accessibility compliance or editorial verification of the full archive.

Additional release check: the Whole Foods Cabricharme recall explicitly states that no illnesses had been reported as of its announcement. A zero report count for this record is supported, whereas the broccoli-sprouts record has a null count and reads “Not reported.” The public projection now says “No illnesses had been reported in the source announcement” instead of equating that with no cases. Verified against the [FDA-hosted company announcement](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/whole-foods-market-issues-allergy-alert-undeclared-egg-cabricharme-cheese), September 13, 2026.

## Story-guide evidence review — September 13, 2026

`publication/data/story-guides.json` contains three small guides with preserved article IDs. Every “known” item and “What changed” item links a reviewed supporting source. Original Noteworthy X URLs are labeled distribution. The guide's `reviewedAt` is an audit date; its `updatedAt` remains the latest dated source included, with explicit calendar-date precision. The timeline contains only original Noteworthy publication records.

### Miami: September 6 updates, September 9 investigative evidence

- [FAA incident statements](https://www.faa.gov/newsroom/statements/accident_incidents): inspected the **September 6, 2026 / Commercial Aviation / Miami** entry, not the page's latest unrelated update. It identifies Flight 7598, the aircraft, route and approximate local landing time. Short source excerpt: “21 Air Flight 7598 overran the runway”.
- [NTSB DCA26MA352](https://www.ntsb.gov/investigations/Pages/DCA26MA352.aspx): event date **September 6**; investigative update **September 9, 2026**; status ongoing. Short source excerpt: “preliminary and subject to change.” Supports Runway 30, investigation identity and the substantive addition of recorder evidence. The page does not present a final probable-cause finding.
- [WPLG Local 10](https://www.local10.com/news/local/2026/09/06/cargo-plane-crashes-after-going-off-miami-international-airport-runway/): published **September 6**, updated **September 7, 2026**. Its account of the sheriff's news conference supports the explicitly attributed casualty statement. The guide does not use that early statement to assert later medical outcomes.

Both timeline IDs refer to September 6 Miami-airport updates. The “unknown” section limits the claims to these dated materials: it does not assert that no later information exists anywhere.

### Whitewater: official all-clear, September 2

[UW-Whitewater announcement 18939](https://announcements.uww.edu/Announcement/Details/18939) has post date **September 2, 2026** and is signed by the chancellor and police chief. Short source excerpt: “there was no weapon and determined there was no threat.” It supports the reported-alert sequence and the all-clear; the [city's same-day statement](https://www.whitewater-wi.gov/article/3109350) separately supports the resolution. The city page explicitly links announcement 18939.

Both Noteworthy updates name the same university and occur within minutes on that date. Neither cited official statement supplies exact alert and all-clear times. The guide therefore labels the chronology as publication times and does not infer an armed attack or a precise emergency duration.

### Clover Hill: final FDA update, August 26

The [June 18 recall](https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/clover-hill-dairy-expands-recall-include-all-clover-hill-dairy-brand-cheese-due-possible-health-risk) is explicitly linked from the [FDA outbreak advisory](https://www.fda.gov/food/outbreaks-foodborne-illness/outbreak-investigation-listeria-monocytogenes-soft-cheese-june-2026). The advisory's current update is **August 26, 2026**. Short source excerpt: “CDC declares outbreak over. FDA’s investigation is complete.”

The final case-count block supports 15 illnesses, 14 hospitalizations and one death. The recommendations support the narrow product-handling advice. The distribution caveat supports the unknown geographic extent. Package eligibility cannot be established from this brief alone. Earlier counts are not added to later totals, and the guide does not equate an ended outbreak with permission to eat recalled products.

Verification: `node --test tests/publication/story-guides.test.js` checks stable real IDs, chronology, every claim/change source contract, date provenance, attribution, resolved status and final outcome counts. No live editorial record was changed.
