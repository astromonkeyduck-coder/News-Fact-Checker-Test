# Inside the Story: Java Sea earthquake source audit

This first feature uses the actual USGS event **us7000tgrk**, September 11, 2026. It is a saved, inspectable source snapshot, not a live seismic monitor. The original publication URL remains `/article.html?id=usgs-us7000tgrk`; the richer feature uses the independent `java-sea-2026` slug. No live post, ingestion job, subscriber channel, or deployment was changed by this data work.

## Data contract

`publication/inside-story/data/java-sea-2026.json` contains:

- `preparedAt`: local feature preparation time; it is not a publication/deployment assertion. Source and earthquake dates remain separately preserved.

- `event`: USGS ID, occurrence `time`, catalogue `updated`, longitude, latitude, `depthKm`, magnitude/type, place, URL, status and source ID.
- `bounds`: `[102, -10, 112, -2]`, in west/south/east/north order and decimal degrees.
- `events`: all four records returned by the exact bounded query, in occurrence order. They have the same event fields.
- `catalogue`: query bounds, start/end times, minimum magnitude, count, source ID and selection limitation.
- `sources`: stable IDs, titles, HTTPS URLs, retrieval timestamps, kinds and descriptions. Dated products have `issuedAt`; explanatory web pages do not receive invented issue dates.
- `evidence`: four real, separately dated product milestones. `time` means product issuance; `eventTime` on origin records means earthquake occurrence. Origin milestones also expose the saved numeric values, method, status and stated errors.
- `shaking`: version 4 issuance/process time, automatic status, units, official grid bounds, display method and a GeoJSON FeatureCollection of 77 polygons. An `earlier` member retains the genuine version 1 contour FeatureCollection.
- `geography.geojson`: nine Natural Earth land polygons clipped to display bounds.
- `context` and `limitations`: attributed interpretation and the feature's practical limits.

`provenance.json` records file hashes, retrieval times, source/product times, transformations and licensing. Eight downloaded USGS files are retained unchanged in `data/source/`, including both version-specific origin XML files and the full superseded-product response. The main JSON is approximately 43 KB; raw audit records are separate from the page payload.

## Why this event was selected

The original Noteworthy import preserved M6.6, 358.597 km depth and coordinates 106.903, -5.0932. A fresh official query showed a later preferred M6.5 origin at 372 km, coordinates 106.8742, -4.9832. Rather than fabricate an initial estimate from the current record, the audit requested official saved history:

[USGS event with superseded products](https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid=us7000tgrk&includesuperseded=true)

USGS [documents `includesuperseded`](https://earthquake.usgs.gov/fdsnws/event/1/) as including superseded products when an event ID is specified. The response contains two real origin versions and four ShakeMap versions. Both downloaded origin XML files agree with the numeric metadata. This provides authentic evidence milestones for the existing publication event without switching to an unrelated historical demonstration.

## Preserved evidence milestones

| Evidence | Product issuance, UTC | Preserved values | Source |
| --- | --- | --- | --- |
| Earlier saved origin | 2026-09-11 21:41:50.040 | M6.6; 358.597 km; 106.9030, -5.0932; 88 origin stations; depth method `from location` | [Version-specific QuakeML](https://earthquake.usgs.gov/product/origin/us7000tgrk/us/1789162910040/quakeml.xml) |
| ShakeMap version 1 | 2026-09-11 21:47:01.069 | M6.6 input; 358.6 km; automatic; preserved MMI 3 contour | [Original contour data](https://earthquake.usgs.gov/product/shakemap/us7000tgrk/us/1789163221069/download/cont_mmi.json) |
| Revised saved origin | 2026-09-12 12:57:42.040 | M6.5; 372 km; 106.8742, -4.9832; 116 origin stations; depth method `from modeling of broad-band P waveforms` | [Version-specific QuakeML](https://earthquake.usgs.gov/product/origin/us7000tgrk/us/1789217862040/quakeml.xml) |
| ShakeMap version 4 | 2026-09-12 21:26:58.779 | M6.5 input; 372 km; automatic; actual 51×51 low-resolution MMI grid | [Original CoverageJSON](https://earthquake.usgs.gov/product/shakemap/us7000tgrk/us/1789248418779/download/coverage_mmi_low_res.covjson) |

The earlier occurrence solution is 2026-09-11 21:23:55.001 UTC; the later solution is 21:23:55.907 UTC. These are estimates of the same earthquake. The 0.906-second revision must not become a second event.

Both saved origins have `review-status: reviewed` **and** `evaluation-status: preliminary`. The feature must not call the later solution final. The earliest saved origin is the earliest origin in this retrieved history, not an assertion that it was the first public alert or the first estimate ever issued.

The [ShakeMap processing record](https://earthquake.usgs.gov/product/shakemap/us7000tgrk/us/1789248418779/download/info.json) distinguishes substantive changes from repeated processing. Its short preserved labels are `Origin updated` for version 3 and `Scheduled repeat` for version 4. Version 3 was issued September 12 at 13:01:07.887 UTC. Do not describe version 4 as new confirmed damage or a fresh earthquake.

## Shaking layer and limits

The latest official [`cont_mmi.json`](https://earthquake.usgs.gov/product/shakemap/us7000tgrk/us/1789248418779/download/cont_mmi.json) is a valid FeatureCollection with **zero features**. No substitute contours or rings were invented. The display uses the official low-resolution CoverageJSON instead.

The source grid has axes `y, x`, shape 51×51, and 2,601 actual values. Every value is retained. For efficient SVG rendering, adjacent equal samples in a row become one rectangle; nearest-sample rectangles meet at coordinate midpoints and are clipped at the outermost sample coordinates. Coordinates are rounded to six decimal places. There is no smoothing, synthetic contour inference, value rescaling or inferred damage footprint. Colors interpolate the source's `preferredPalette`.

**The displayed low-resolution values are 2.8–2.9 MMI. This is the range of that downloaded grid, not the maximum of the full-resolution product or the maximum shaking experienced by people.** The separate processing metadata reports a full-grid maximum of 3.167 and another `max` value of 3.013. These quantities are not silently substituted for one another. Version 1 contours and version 4 grid cells differ in representation and resolution; their shapes must not be presented as a measured change in damage area.

The processing input summary lists six intensity observations and zero seismic stations for this ShakeMap. Its uncertainty metadata also records six flagged intensity observations. A count in this summary does not establish that every observation was accepted or that shaking was measured at every displayed cell. The product remains an automatic estimate based on a reviewed origin. This feature makes no verified casualty, building-damage, exposure or tsunami-safety claim.

[USGS ShakeMap description](https://earthquake.usgs.gov/data/shakemap/) explains the purpose of these ground-motion and intensity products. [USGS magnitude/intensity FAQ](https://www.usgs.gov/faqs/what-difference-between-earthquake-magnitude-and-earthquake-intensity-what-modified-mercalli) and [USGS magnitude and shaking explainer](https://www.usgs.gov/programs/earthquake-hazards/earthquake-magnitude-energy-release-and-shaking-intensity) support distinguishing earthquake size from shaking at a location. [USGS depth explanation](https://www.usgs.gov/faqs/what-depth-do-earthquakes-occur-what-significance-depth) supports a general explanation that source distance and depth affect surface shaking. The feature does not establish depth as the sole cause of this event's modeled intensity.

## Regional sequence selection

[Exact USGS catalogue query](https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2026-09-01T00%3A00%3A00&endtime=2026-09-13T00%3A00%3A00&minlatitude=-10&maxlatitude=-2&minlongitude=102&maxlongitude=112&minmagnitude=3&orderby=time-asc)

Selection: M3 or greater, longitude 102–112°E, latitude 10–2°S, September 1 at 00:00 through September 13 at 00:00 UTC. The response contains exactly four earthquakes: `us7000te82`, `us7000teiy`, `us7000tfyn`, and `us7000tgrk`. All returned records are included. Three precede the featured earthquake; the query returned none after it within the selected interval and bounds. This does not establish the absence of unreported/smaller earthquakes or earthquakes outside the selection.

The sequence control shows occurrence time using the current retrieved solutions. It cannot recreate what the public knew at each selected time; some solutions were updated afterward. The evidence selector uses actual saved product issuance times separately. Geographic and temporal proximity does not establish an aftershock or causal relationship. Use “regional catalogue events,” never an unqualified “aftershock sequence.”

## Geography and rights

[Source dataset: Natural Earth 1:50m land](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/), retrieved from the [project's published GeoJSON](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson). The original download SHA-256 and byte count are in provenance. Polygon rings were clipped to the feature bounds using Sutherland–Hodgman clipping, with coordinates rounded to five decimal places. This is a contextual land map, not authoritative coastal detail, a fault interpretation, or a hazard boundary.

[Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) place the vector data in the public domain. Credit: Made with Natural Earth. [USGS copyright guidance](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted) states that USGS-authored or produced data and information are in the U.S. public domain and requests source acknowledgement. Credit: U.S. Geological Survey. No third-party photographs or map tiles were copied.

## Verification

`node --test tests/publication/inside-story-data.test.js` passes five focused source integrity checks: byte-level source hashes; exact preferred hypocentre and bounded event selection; true version/timestamp/value correspondence including XML depth units; one-to-one coverage of all official MMI samples; and bounded geography plus listed claim sources. These checks are independent of the page renderer and interaction implementation.

Remaining limits are explicit in the dataset: this is a frozen retrieval, later revisions may exist, origin review is not a final impact assessment, the selected catalogue is not a complete local monitoring network, and modeled shaking does not establish casualties or damage.

## Independent narrative audit

The renderer correctly uses `catalogue.minimumMagnitude` (3), separates occurrence-time filtering from preserved evidence issuance, and identifies displayed MMI 2.8–2.9 as the low-resolution grid range rather than the event-wide maximum. Source hashes and all four catalogue records remain unchanged after renaming the local feature timestamp from `publishedAt` to `preparedAt`.

Two material presentation fixes were reported to the renderer owner: resolve the product-history link explicitly by the `event-record` source ID (a generic `version` match selects the current grid), and identify the shaking layer as fixed version 4 when an earlier origin milestone is selected. The public dataset and separate provenance manifest should have accurately labeled download links. The narrative should describe the “saved USGS record” rather than promise that frozen values are current.
