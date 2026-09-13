# Geography Challenge: Atlas Expedition

This local release contains a complete ten-target Expedition, Classic 50, Hard 50, Typing 50, and a separate ten-target nonvisual location-and-neighbor reasoning category. It uses bundled geographic data; playing never calls a population API, map service, leaderboard, or other backend. The root Games app owns navigation, the notebook, settings, daily composition, sharing, and storage.

## Frozen factual edition

Content version: `atlas-wdi2024-20260713-ne512-v1`. Population reference year: **2024**. Source: World Bank **World Development Indicators, source 2**, API `lastupdated: 2026-07-13`. These are the population values from that frozen API response, not a claim to be the latest population now. WDI identifies underlying population providers; this collection is not labeled as one UN population revision.

The 50 were computed from the complete population response, not copied from a remembered list. The build excludes World Bank aggregates (`region.id: NA`), requires a numeric 2024 population and an identity present in the geometry, and retains Natural Earth units whose `TYPE` is `Sovereign country` or `Country`. It excludes `Dependency`, `Disputed`, `Indeterminate`, and `Sovereignty` map classes. Of 197 eligible records, the first 50 in descending population order are selected; ISO3 breaks a tie. This explicit provider-based game rule is not a declaration of legal sovereignty or UN membership.

The last two included records are Madagascar (rank 49, 31,964,956) and Côte d’Ivoire (rank 50, 31,934,230). The next five excluded records are Nepal, Cameroon, Venezuela, Australia, and Niger. The exact ranked values, selection audit, and raw population response are shipped together. Changing the source edition can change the 50; a future update must receive a new content version.

Primary sources and rights:

- [World Bank population indicator and license](https://data.worldbank.org/indicator/SP.POP.TOTL): CC BY 4.0; credit World Bank and its source providers. The retained source response is `games/data/atlas-population-source.json`, with country/aggregate metadata in `atlas-country-metadata.json`.
- [Frozen population API query](https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?date=2024&format=json&per_page=400) and [country metadata API](https://api.worldbank.org/v2/country?format=json&per_page=400): retrieved September 13, 2026. Each response had one complete page. Retrieval timestamps, byte counts, and SHA-256 hashes are in `atlas-provenance.json`.
- [Natural Earth 1:50m Admin 0 countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/): the geometry itself is pinned to [the v5.1.2 Git tag](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson). The human-facing download page may name a different downloadable release; the pinned source URL and hash identify this release precisely.
- [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/): public domain. Attribution displayed in the interface: “Natural Earth.” Natural Earth uses de facto map conventions; these are not legal boundary determinations.

All 242 source map identities remain in the dataset for geographic context; Antarctica is omitted from the displayed world. Polygon rings, holes, disconnected islands, and MultiPolygons are retained. Coordinates are rounded to 0.001°. A single ISO3 identity can therefore be selected through multiple islands or mainland pieces. The drawn geometry and hit test use the same coordinates. No synthetic rectangular country targets are used.

Neighbor hints come from shared source polygon edges, matched at five decimal places before display rounding. They describe **mapped land neighbors**, including the map’s handling of overseas and disputed units. For example, the France identity includes French Guiana, and Brazil can consequently appear as a mapped neighbor of France. The UI states that population coverage can differ from displayed administrative geography. Label points, subregions, and map facts come from the same Natural Earth edition. Population cards link directly to the relevant World Bank indicator page.

## Modes and learning rules

Expedition starts at a seeded regional anchor (India, United States, Nigeria, or Germany), followed by the nearest eligible label points, for ten initial targets. Nearness uses great-circle distance between source label points; it is not a border-crossing route or a travel-distance claim. Missed, assisted, or revealed targets return once after intervening questions when space permits, otherwise at the end. These review stops earn no additional points and never overwrite the original result. Classic, Hard, and Typing use all 50, in a seeded shuffle. The optional `targets` argument supports the exact fixed daily subset.

Hard hides internal outlines on unanswered countries. Completed countries can be marked in the journal and on the map as feedback. Typing illuminates a real country shape without naming it. Location reasoning hides the visual map and asks for a typed country using region, mapped neighbors, and the frozen population rank. It is a separate category, not an accessible claim that a spatial map task and a verbal reasoning task measure the same skill. Reasoning’s optional name/spelling hints add new information rather than repeating its initial geographic clue.

Scores: first correct attempt 100; correct after one error 60; correct after two or more errors 30. Any hint caps an answer at 30; reveal earns zero. No lives, speed bonus, time penalty, or automatic advancement. A correctly resolved target is counted as found even after errors; the result also retains attempt count and assistance so first-attempt performance remains distinguishable.

Aliases accept case/diacritic/punctuation variations and named established alternatives: for example Türkiye/Turkey, Côte d’Ivoire/Ivory Coast, DR Congo/DRC, and South Korea/Republic of Korea. Ambiguous “Congo,” “Korea,” and “America” do not identify a target. Niger is never accepted for Nigeria; South Sudan is never accepted for Sudan. There is no fuzzy string matching that can silently turn another country into a correct answer.

`updateMastery(previous, summary, timestamp)` can retain exposure, assisted completion, independent first-attempt completion, and durable recall. A seen record upgrades in place when completed during the same session. “Recalled independently” requires two distinct sessions in the **same mode**, with correct, unassisted, first-attempt responses at least 86,400,000 milliseconds apart. An immediate repeat, assisted response, or unscored review cannot establish durable recall. The root notebook implements the matching rule; these are local practice labels, not validated cognitive assessments.

## Integration contract

Lazy-load `/games/atlas.css`, then `/games/data/atlas-data.js`, `/games/atlas.js`, and `/games/atlas-ui.js`. The globals are `NoteworthyAtlasData`, `NoteworthyAtlas`, and `NoteworthyAtlasUI`; the model also supports CommonJS for tests. Mount only after those local assets have loaded:

```js
const controller = NoteworthyAtlasUI.mount(container, {
  mode: 'expedition', // classic | hard | typing | reasoning
  seed: 'shared-content-seed',
  targets: ['USA', 'IDN', 'MDG'], // optional; eligible ISO3 IDs
  saved: previousAtlasState,     // optional, exact engine save
  settings,
  onSave(atlasState) { /* root stores its own wrapper */ },
  onFinish(result) { /* root records one receipt and shows results */ }
});
controller.pause(true);
controller.pause(false);
controller.getState(); // serializable copy
controller.destroy(); // removes owned listeners and markup
```

The UI itself has no storage key. `onSave` receives the complete serializable state: content and rules versions, unique session ID, seed, mode, exact targets and review queue, position, attempts, assistance, partially typed input, feedback phase, pause state, camera, results, and completion receipt flag. A resumed game continues that position; it does not regenerate a route. An unreadable or different-edition save produces a recovery message and no save callback until the player explicitly starts a new run. The supplied record is not mutated. A thrown save callback displays a storage warning while play remains possible.

`onFinish` receives `{ score, maxScore, correct, total, assistance, results, reviewResults, seen, mode, seed, contentVersion, rules, sessionId, createdAt, complete }`. Each primary result is `{ id, correct, assistance, attempts, score, review:false }`; assistance is **numeric**: `0` none, `1` first hint, `2` second hint, `3` reveal. Summary assistance is the number of assisted primary results. `reviewResults` are separate and unscored in the total. Root uses its own run ID for idempotent notebook receipts; it must never put new results into a legacy leaderboard category.

Map controls support pointer drag, two-pointer pinch, visible zoom/pan controls, keyboard arrows and +/−, Enter at the crosshair, and explicit latitude/longitude entry. Drag movement above seven pixels is not treated as selection; cancellation cannot answer. Numeric centering zooms to a usable view; world-edge constraints are announced with the actual crosshair coordinates. Country shapes are not labeled for unanswered map questions. Question changes do not automatically pan or zoom to the answer. “Center this country” is only available after an explicit answer/reveal and requires a click.

Keyboard answer submission moves focus to Continue; Continue moves to the next input or question heading. Pausing holds scoring state, and leaving the document pauses an unfinished run. Sound is silent in the Atlas engine; the root’s opt-in audio and settings controls remain responsible for audio. Styling uses the shared Games variables, visible focus, 44px main controls, and reduced-motion rules. The map has an explicit verbal alternative rather than exposing a hidden list of answer names.

## Preservation and maintenance

The preexisting `geography_best_time`, `geography_progress`, and `geography_progress_<Auth0 sub>` keys are untouched. Legacy categories `geography-classic`, `geography-hard`, `geography-typing`, and older `geography` remain in the old code. Their existing endpoint is `/.netlify/functions/leaderboard`; the new engine never posts to it. Old speed/lives-based scores are not comparable to this edition’s accuracy scores. The development harness uses only `noteworthy-atlas-development-test-<mode>`.

To reproduce the data, download the exact pinned geometry source and run:

```sh
python3 games/data/atlas-build.py --geometry /path/to/ne_50m_admin_0_countries.geojson --output /tmp/atlas-rebuild
node --test tests/games/atlas*.test.js
```

The build is offline and checks the exact three source SHA-256 hashes, API edition, and reference year before producing data. A source change fails until deliberately reviewed and versioned. Rebuilding to a separate directory reproduced all countries, facts, selection audit, and geometry exactly. Generated preparation timestamps can differ. No scheduler or content-refresh function runs from this subsystem.

The initial lazy payload is about 1.75 MB raw and **under 600 KB gzip** for data, model, UI, and CSS together. The geometry is parsed and drawn only when Atlas is selected. This measured transfer size is not a mobile frame-rate claim. Country paths are constructed once per mount; ordinary answers update classes and small journal panels rather than rebuilding the world map.

## Verification and remaining limits

Fifteen focused Node tests pass: all five modes terminate correctly; all 50 are source-derived; source hashes match; islands/holes are selectable; aliases reject ambiguity; seed and exact daily targets persist; accuracy/hint/reveal scoring is correct; stale actions and pause cannot duplicate results; reviews do not inflate mastery; saves preserve partial work and reject inconsistent records; durable recall requires a day and the same mode; camera clamps do not locate targets automatically.

Actual in-app browser playtests, September 13, 2026, are recorded in `tests/games/atlas-browser-evidence.json`:

| Surface | Completed interaction | Result |
| --- | --- | --- |
| Isolated Atlas harness | Ten-target Expedition; intentional Mexico miss, hint, and later review | 930/1000; one unscored review |
| Isolated Atlas harness | Classic: all 50 through geographic map clicks | 5000/5000 |
| Isolated Atlas harness | Typing: all 50 typed; reload at target 27 retained partial text, camera, and score | 5000/5000 |
| Integrated Games wrapper | Location reasoning: ten clues, typed submissions, keyboard Continue focus | 1000/1000, saved in journal |
| Integrated Games wrapper | Hard: all 50 unique countries; 49 map clicks and one explicit numeric coordinate answer | 5000/5000, saved in journal |
| Integrated Games wrapper | Expedition: ten map targets; pause/reload at target 4 preserved Colombia, 300/1000 and 1.6× camera, then resumed | 1000/1000, saved in journal |

Hard drag and keyboard pan moved the view without answering. The integrated journal showed the actual completed results and “Found independently,” not a fabricated durable-recall label. Layout screenshots checked 375, 390, 768, 1280, and 1440 pixels; the mobile/tablet document width equaled the viewport. Root and this engine were tested as separate layers where noted; the harness results are not represented as wrapper runs.

Review images are retained in `docs/screenshots/`: `games-atlas-hard-1280.jpg`, `games-atlas-hard-375.jpg`, `games-atlas-hard-390.jpg`, `games-atlas-hard-768.jpg`, and `games-atlas-hard-result-1440.jpg`.

Not yet tested: a physical touch device/two-finger pinch, VoiceOver or NVDA, browser CPU/network throttling, or low-memory mobile hardware. Keyboard use and the browser accessibility tree were exercised, but that does not substitute for assistive-technology user testing. The frozen factual content still carries `editorialReview: publisher-review-pending` to preserve the publisher’s final review gate. The prototype geographic rendering is a flat equirectangular locator, not a measurement or area-comparison tool.
