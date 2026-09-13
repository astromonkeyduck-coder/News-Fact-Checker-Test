# Inside the Story — development release

The first visual feature, **Deep beneath the Java Sea**, is implemented at `/inside-the-story/java-sea-2026/`. The homepage has an immediate link beside “On the front page” and a dedicated visual feature after the lead coverage. The original USGS article links to the later source account while preserving its original headline, date and values.

## Reader experience

Four chapters share a real geographic map: the earthquake, the bounded regional catalogue, estimated shaking, and preserved revisions. The occurrence slider filters four actual catalogue records. The separate source slider/select steps between four genuine retained USGS products. Earlier and later origins compare magnitude, depth and stations used for location. A selected preserved origin has its own marker; the latest saved epicentre remains an explicit reference.

The shaking map uses all 2,601 values in the actual low-resolution USGS version 4 grid, merged into 77 equal-sample polygons. It does not invent contours, aftershock connections, damage or casualties. Its displayed 2.8–2.9 MMI range is distinguished from an event-wide maximum and from earthquake magnitude. The rectangular edge is the supplied grid extent. The source-history view does not rewind that grid or claim to reconstruct everything known by the newsroom.

Visible data controls have equivalent ordinary source links in server-rendered HTML. The account, comparison table, dated source history and methodology remain available when JavaScript is blocked, unavailable or invalid. Native buttons, select and range controls support keyboard input, and committed changes use a polite status message. No autoplay, scroll trapping, animation, geolocation or account data is involved. URL parameters preserve a selected chapter, time, event, source version and layer; malformed and partial links normalize to a coherent view. Reset removes only this feature’s parameters.

## Sources and responsibility

See `publication-inside-story-sources.md` and the downloadable source/provenance JSON files for exact URLs, source times, preserved bytes, transformations, hashes and licensing. The source repository contains eight unmodified official data responses, including both origin QuakeML records. Natural Earth geography is credited. Event dates in the hero and teaser explicitly name UTC; full occurrence and issuance times also use UTC.

This is a prepared development feature based on a frozen source retrieval. The draft explicitly records that individual editor review is pending. A source archive is not a live monitoring service. No original reporting, individual editor identity, final scientific assessment, or confirmed impact is invented. The USGS source may have changed after retrieval.

## Verification

- 209 tests pass across publication, source quality and food-safety regressions. This includes 41 new source integrity, model, controller, partial URL, render and route checks.
- Static publication build passes; the two production HTML functions bundle successfully for Node 20.
- Independent review caught and verified fixes for fallback catalogue links, historical source selection, UTC labels, SVG visibility and partial-link consistency.
- Browser checks cover desktop, tablet and phone layouts, all four chapter views, native source selector, keyboard range Home/End/Arrow controls, actual visible SVG layers, reset and restored source state. Exact captured responsive results are saved in `publication-inside-story-browser-results.json`.
- Independent visual review inspected desktop revisions/shaking and phone overview/shaking captures and found no material visual defect after reported fixes. The gallery uses ordinary viewport captures, avoiding full-page stitching artifacts.

Performance: the feature’s HTML is approximately 100 KB uncompressed and 22 KB gzipped; actual linked asset sizes are recorded in the browser results. No third-party map or animation library is loaded. Feature code is scoped to its page; the homepage teaser is static SVG and ordinary articles do not load the interactive dataset or scripts. Existing shared fonts remain external. This is not a measured production Core Web Vitals claim.

## Updating or extending the feature

1. Preserve the original public record and fetch version-specific source documents. Save exact source bytes and retrieval/product times before editing the story dataset.
2. Maintain stable source/event IDs. Distinguish occurrence, product issuance, retrieval and editorial preparation dates. Do not backfill a historical estimate from today’s catalogue.
3. Update the source dataset and provenance hashes together. The curated renderer deliberately rejects incomplete required evidence or silently dropped data; changing this feature’s four-event selection requires an explicit editorial/render review.
4. Label any new map layer with its real source version and meaning. A modeled field, observation and verified impact are different evidence types. Only show a changed historical geometry when that version’s actual geometry has been preserved.
5. Run the publication suite and build, then inspect all chapters on phones and desktops. Review source changes and name the responsible editor before authorizing a public release.

No production deployment, live subscriber communication or live editorial record mutation occurred. The original working checkout remains preserved; the deliverable is in the isolated development preview and durable release overlay.
